/**
 * Custom React hook for Web Speech API — voice input (STT) and output (TTS).
 * Uses browser-native SpeechRecognition and speechSynthesis APIs.
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface UseVoiceReturn {
    isListening: boolean;
    transcript: string;
    isSpeaking: boolean;
    startListening: () => void;
    stopListening: () => void;
    speak: (text: string) => void;
    stopSpeaking: () => void;
    isSupported: boolean;
}

export function useVoice(): UseVoiceReturn {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isSupported, setIsSupported] = useState(false);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        const SpeechRecognition =
            typeof window !== "undefined"
                ? window.SpeechRecognition || window.webkitSpeechRecognition
                : null;
        setIsSupported(!!SpeechRecognition && !!window.speechSynthesis);
    }, []);

    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const SILENCE_TIMEOUT_MS = 3000; // Auto-stop after 3s of silence

    const clearSilenceTimer = useCallback(() => {
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
    }, []);

    const startListening = useCallback(() => {
        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        // Stop any existing recognition first
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch { }
        }
        clearSilenceTimer();
        setTranscript("");

        const recognition = new SpeechRecognition();
        recognition.continuous = true;       // Keep listening across short pauses
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onstart = () => {
            setIsListening(true);
            // Start the silence timer — if no speech at all, stop after timeout
            silenceTimerRef.current = setTimeout(() => {
                recognition.stop();
            }, SILENCE_TIMEOUT_MS);
        };

        recognition.onresult = (event: any) => {
            let finalTranscript = "";
            for (let i = 0; i < event.results.length; i++) {
                finalTranscript += event.results[i][0].transcript;
            }
            setTranscript(finalTranscript);

            // Reset the silence timer every time we get new speech
            clearSilenceTimer();
            silenceTimerRef.current = setTimeout(() => {
                recognition.stop();
            }, SILENCE_TIMEOUT_MS);
        };

        recognition.onerror = (event: any) => {
            if (event.error === "no-speech") return;
            clearSilenceTimer();
            recognitionRef.current = null;
            setIsListening(false);
        };

        recognition.onend = () => {
            clearSilenceTimer();
            recognitionRef.current = null;
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
    }, [clearSilenceTimer]);

    const stopListening = useCallback(() => {
        clearSilenceTimer();
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
            setIsListening(false);
        }
    }, [clearSilenceTimer]);

    const speak = useCallback((text: string) => {
        if (!window.speechSynthesis) return;

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        window.speechSynthesis.speak(utterance);
    }, []);

    const stopSpeaking = useCallback(() => {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        }
    }, []);

    return {
        isListening,
        transcript,
        isSpeaking,
        startListening,
        stopListening,
        speak,
        stopSpeaking,
        isSupported,
    };
}
