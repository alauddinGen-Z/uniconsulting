"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Loader2, Mic, MicOff } from "lucide-react";

interface MessageInputProps {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    isSending: boolean;
    placeholder?: string;
}

export default function MessageInput({
    value,
    onChange,
    onSend,
    isSending,
    placeholder = "Type a message..."
}: MessageInputProps) {
    // Voice-to-Text State
    const [isListening, setIsListening] = useState(false);
    const [speechSupported, setSpeechSupported] = useState(false);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            setSpeechSupported(true);
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                onChange(value + (value ? ' ' : '') + transcript);
                setIsListening(false);
            };

            recognitionRef.current.onerror = () => {
                setIsListening(false);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        }
    }, [value, onChange]);

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        } else {
            recognitionRef.current?.start();
            setIsListening(true);
        }
    };

    return (
        <div className="p-4 bg-white border-t border-slate-100 flex-shrink-0">
            <div className="flex items-center gap-3">
                {speechSupported && (
                    <button
                        onClick={toggleListening}
                        className={`p-3 rounded-xl transition-colors ${isListening
                            ? 'bg-red-500 text-white animate-pulse'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                        title={isListening ? 'Stop listening' : 'Voice input'}
                    >
                        {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>
                )}

                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && onSend()}
                    placeholder={isListening ? "Listening..." : placeholder}
                    className="flex-1 bg-slate-50 rounded-xl px-4 py-3 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 border border-slate-200"
                />

                <button
                    onClick={onSend}
                    disabled={isSending || !value.trim()}
                    className="p-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 transition-all shadow-lg shadow-orange-200"
                >
                    {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
            </div>
        </div>
    );
}
