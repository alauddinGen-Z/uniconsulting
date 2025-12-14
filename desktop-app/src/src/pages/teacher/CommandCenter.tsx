import { useAppStore } from '../../store/appStore';
import { Users, Clock, CheckCircle, XCircle } from 'lucide-react';

export default function CommandCenter() {
    const { students } = useAppStore();

    console.log('[CommandCenter] Rendering, students count:', students.length);

    const stats = {
        total: students.length,
        pending: students.filter(s => s.approval_status === 'pending').length,
        approved: students.filter(s => s.approval_status === 'approved').length,
        rejected: students.filter(s => s.approval_status === 'rejected').length,
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Command Center</h1>
                <p className="text-slate-500">Overview of your students and activity</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm text-slate-500">Total Students</div>
                            <div className="text-3xl font-bold text-slate-900">{stats.total}</div>
                        </div>
                        <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                            <Users className="w-6 h-6 text-orange-500" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm text-slate-500">Pending</div>
                            <div className="text-3xl font-bold text-yellow-500">{stats.pending}</div>
                        </div>
                        <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                            <Clock className="w-6 h-6 text-yellow-500" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm text-slate-500">Approved</div>
                            <div className="text-3xl font-bold text-green-500">{stats.approved}</div>
                        </div>
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-green-500" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm text-slate-500">Rejected</div>
                            <div className="text-3xl font-bold text-red-500">{stats.rejected}</div>
                        </div>
                        <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                            <XCircle className="w-6 h-6 text-red-500" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Students */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Recent Students</h2>
                {students.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">No students yet</div>
                ) : (
                    <div className="space-y-3">
                        {students.slice(0, 5).map(student => (
                            <div key={student.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold">
                                        {student.full_name?.[0] || '?'}
                                    </div>
                                    <div>
                                        <div className="font-medium text-slate-900">{student.full_name || 'Unknown'}</div>
                                        <div className="text-sm text-slate-500">{student.email}</div>
                                    </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${student.approval_status === 'approved' ? 'bg-green-100 text-green-600' :
                                    student.approval_status === 'pending' ? 'bg-yellow-100 text-yellow-600' :
                                        'bg-red-100 text-red-600'
                                    }`}>
                                    {student.approval_status}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
