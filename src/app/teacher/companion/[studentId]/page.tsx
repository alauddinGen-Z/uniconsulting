import CompanionWindowDynamic from "@/components/teacher/automation/CompanionWindowDynamic";

interface Props {
    params: { studentId: string };
}

// Dynamic route: /teacher/companion/[studentId]
export default function CompanionDynamicPage({ params }: Props) {
    return <CompanionWindowDynamic studentId={params.studentId} />;
}
