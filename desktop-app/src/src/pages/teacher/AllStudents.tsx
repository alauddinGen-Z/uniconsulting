import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { supabase } from '../../lib/supabase';
import { Search, CheckCircle, XCircle, Clock, User } from 'lucide-react';

export default function AllStudents() {
    const { students, updateStudent } = useAppStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

    const filteredStudents = students.filter(student => {
        const matchesSearch = !searchQuery ||
            student.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            student.email?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || student.approval_status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleApprove = async (studentId: string) => {
        const { error } = await supabase
            .from('profiles')
            .update({ approval_status: 'approved' })
            .eq('id', studentId);

        if (!error) {
            updateStudent(studentId, { approval_status: 'approved' });
        }
    };

    const handleReject = async (studentId: string) => {
        const { error } = await supabase
            .from('profiles')
            .update({ approval_status: 'rejected' })
            .eq('id', studentId);

        if (!error) {
            updateStudent(studentId, { approval_status: 'rejected' });
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">All Students</h1>
                    <p className="text-slate-500">{students.length} students total</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search students..."
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                </select>
            </div>

            {/* Students List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                {filteredStudents.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <User className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p>No students found</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {filteredStudents.map(student => (
                            <div key={student.id} className="p-4 hover:bg-slate-50 transition">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                            {student.full_name?.[0] || '?'}
                                        </div>
                                        <div>
                                            <div className="font-medium text-slate-900">{student.full_name || 'Unknown'}</div>
                                            <div className="text-sm text-slate-500">{student.email}</div>
                                            {student.preferred_country && (
                                                <div className="text-xs text-slate-400 mt-1">
                                                    Interested in: {student.preferred_country}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${student.approval_status === 'approved' ? 'bg-green-100 text-green-600' :
                                            student.approval_status === 'pending' ? 'bg-yellow-100 text-yellow-600' :
                                                'bg-red-100 text-red-600'
                                            }`}>
                                            {student.approval_status === 'approved' && <CheckCircle className="w-3 h-3" />}
                                            {student.approval_status === 'pending' && <Clock className="w-3 h-3" />}
                                            {student.approval_status === 'rejected' && <XCircle className="w-3 h-3" />}
                                            {student.approval_status}
                                        </span>

                                        {student.approval_status === 'pending' && (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleApprove(student.id)}
                                                    className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleReject(student.id)}
                                                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
