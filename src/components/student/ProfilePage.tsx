"use client";

import { useState } from "react";
import { User, Users } from "lucide-react";
import IdentityTab from "./tabs/IdentityTab";
import FamilyTab from "./tabs/FamilyTab";

interface ProfilePageProps {
    isLocked?: boolean;
}

export default function ProfilePage({ isLocked }: ProfilePageProps) {
    const [activeSection, setActiveSection] = useState("identity");

    const sections = [
        { id: "identity", label: "Identity", icon: User },
        { id: "family", label: "Family", icon: Users },
    ];

    return (
        <div className="h-full flex flex-col">
            {/* Fixed Header Bar with Title and Navigation */}
            <div className="flex-none bg-gradient-to-r from-orange-50/80 to-pink-50/80 backdrop-blur-sm sticky top-0 z-20 -mx-6 lg:-mx-8 px-6 lg:px-8 py-4 border-b border-slate-100/50">
                <div className="flex items-center justify-between">
                    {/* Page Header */}
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 shadow-sm">
                            <User className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">Profile</h2>
                            <p className="text-slate-400 text-sm">Your personal and family information</p>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex gap-1 p-1 bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100">
                        {sections.map((section) => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-200 ${activeSection === section.id
                                    ? "bg-orange-500 text-white shadow-md"
                                    : "text-slate-600 hover:bg-slate-100"
                                    }`}
                            >
                                <section.icon className="w-4 h-4" />
                                {section.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Section Content - Scrollable Area */}
            <div className="flex-1 pt-6 overflow-y-auto">
                {activeSection === "identity" && (
                    <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
                        <IdentityTab isLocked={isLocked} />
                    </div>
                )}

                {activeSection === "family" && (
                    <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
                        <FamilyTab isLocked={isLocked} />
                    </div>
                )}
            </div>
        </div>
    );
}
