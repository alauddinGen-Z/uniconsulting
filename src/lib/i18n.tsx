"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

// ============================================================================
// 1. TRANSLATION DICTIONARIES
// ============================================================================

export type LanguageCode = "en" | "ru" | "kg";

type Translations = {
    [key: string]: {
        en: string;
        ru: string;
        kg: string;
    }
}

const DICTIONARY: Translations = {
    // Sidebar
    "nav.dashboard": { en: "Dashboard", ru: "Главная", kg: "Башкы бет" },
    "nav.mentors": { en: "Mentors", ru: "Менторы", kg: "Менторлор" },
    "nav.universities": { en: "Universities", ru: "Университеты", kg: "Университеттер" },
    "nav.essays": { en: "Essays", ru: "Эссе", kg: "Эсселер" },
    "nav.documents": { en: "Documents", ru: "Документы", kg: "Документтер" },
    "nav.messages": { en: "Messages", ru: "Сообщения", kg: "Билдирүүлөр" },
    "nav.profile": { en: "Profile", ru: "Профиль", kg: "Профиль" },
    "nav.application": { en: "Application", ru: "Заявка", kg: "Табыштама" },
    "nav.menu": { en: "Menu", ru: "Меню", kg: "Меню" },

    // Teacher Sidebar
    "nav.queue": { en: "Student Queue", ru: "Очередь студентов", kg: "Студенттер кезеги" },
    "nav.stats": { en: "Statistics", ru: "Статистика", kg: "Статистика" },
    "nav.command_center": { en: "Command Center", ru: "Центр Управления", kg: "Башкаруу борбору" },
    "nav.students": { en: "All Students", ru: "Все студенты", kg: "Бардык студенттер" },
    "nav.ai_matcher": { en: "AI Matcher", ru: "AI Подбор", kg: "AI Тандоо" },
    "nav.automation": { en: "Automation", ru: "Автоматизация", kg: "Автоматташтыруу" },
    "nav.admin": { en: "Admin Panel", ru: "Админ панель", kg: "Админ панели" },

    // Common Actions
    "action.sign_out": { en: "Sign Out", ru: "Выйти", kg: "Чыгуу" },
    "action.settings": { en: "Settings", ru: "Настройки", kg: "Жөндөөлөр" },
    "action.view_profile": { en: "View Profile", ru: "Профиль", kg: "Профилди көрүү" },

    // Settings Modal
    "settings.title": { en: "Settings", ru: "Настройки", kg: "Жөндөөлөр" },
    "settings.security": { en: "Security", ru: "Безопасность", kg: "Коопсуздук" },
    "settings.notifications": { en: "Notifications", ru: "Уведомления", kg: "Билдирмелер" },
    "settings.appearance": { en: "Appearance", ru: "Внешний вид", kg: "Көрүнүш" },
    "settings.language": { en: "Language", ru: "Язык", kg: "Тил" },

    // Change Password
    "password.new": { en: "New Password", ru: "Новый пароль", kg: "Жаңы сырсөз" },
    "password.confirm": { en: "Confirm New Password", ru: "Подтвердите пароль", kg: "Сырсөздү тастыктоо" },
    "password.update": { en: "Update Password", ru: "Обновить пароль", kg: "Сырсөздү жаңыртуу" },

    // Theme
    "theme.light": { en: "Light", ru: "Светлая", kg: "Жарык" },
    "theme.dark": { en: "Dark", ru: "Темная", kg: "Караңгы" },
    "theme.system": { en: "System", ru: "Системная", kg: "Системалык" },
};

// ============================================================================
// 2. CONTEXT & PROVIDER
// ============================================================================

interface LanguageContextType {
    language: LanguageCode;
    setLanguage: (lang: LanguageCode) => void;
    t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState<LanguageCode>("en");

    // Load from local storage on mount
    useEffect(() => {
        const stored = localStorage.getItem("uni_language");
        if (stored && ["en", "ru", "kg"].includes(stored)) {
            setLanguageState(stored as LanguageCode);
        }
    }, []);

    // Save to local storage on change
    const setLanguage = (lang: LanguageCode) => {
        setLanguageState(lang);
        localStorage.setItem("uni_language", lang);
    };

    // Translation function
    const t = (key: string) => {
        const entry = DICTIONARY[key];
        if (!entry) return key; // Return key if translation missing
        return entry[language] || entry.en; // Fallback to EN
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

// ============================================================================
// 3. HOOK
// ============================================================================

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error("useLanguage must be used within a LanguageProvider");
    }
    return context;
}
