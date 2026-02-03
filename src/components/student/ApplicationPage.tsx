"use client";

import { useState } from "react";
import { GraduationCap, Building, PenTool } from "lucide-react";
import UniversityList from "./UniversityList";
import AcademicTab from "./tabs/AcademicTab";
import EssaysTab from "./tabs/EssaysTab";

interface ApplicationPageProps {
    isLocked?: boolean;
}

export default function ApplicationPage({ isLocked }: ApplicationPageProps) {
    const [activeSection, setActiveSection] = useState("universities");

    const sections = [
        { id: "universities", label: "Universities", icon: Building },
        { id: "academic", label: "Academic", icon: GraduationCap },
        { id: "essays", label: "Essays", icon: PenTool },
    ];

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 shadow-sm">
                    <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Application</h2>
                    <p className="text-slate-400 text-sm">Universities, academic records, and essays</p>
                </div>
            </div>

            {/* Sticky Navigation - Sticks to top when scrolled */}
            <div className="sticky top-0 z-20 py-3 bg-gradient-to-b from-orange-50 via-orange-50/95 to-transparent">
                <div className="flex gap-1 p-1 bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 w-fit">
                    {sections.map((section) => (
                        <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 ${activeSection === section.id
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

            {/* Section Content */}
            <div>
                {activeSection === "universities" && (
                    <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
                        <UniversityList isLocked={isLocked} />
                    </div>
                )}

                {activeSection === "academic" && (
                    <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
                        <AcademicTab onUnlock={() => { }} isLocked={isLocked} />
                    </div>
                )}

                {activeSection === "essays" && (
                    <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
                        <EssaysTab isLocked={isLocked} />
                    </div>
                )}
            </div>
        </div>
    );
}
