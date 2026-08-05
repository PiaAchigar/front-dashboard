import { useState, useEffect } from "react";

interface AttendanceRecord {
  id: string;
  subscriptionId: string;
  activityId: string;
  classDate: string;
  attended: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AttendanceData {
  subscriptionId: string;
  year: number;
  month: number;
  monthName: string;
  totalClasses: number;
  attendedCount: number;
  records: AttendanceRecord[];
}

interface AttendanceTrackerProps {
  subscriptionId: string;
  year?: number;
  month?: number;
}

export function AttendanceTracker({ subscriptionId, year, month }: AttendanceTrackerProps) {
  const [attendance, setAttendance] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        setLoading(true);
        setError(null);
        const apiUrl = import.meta.env.VITE_API_URL as string;

        let url = `${apiUrl}/api/training-subscriptions/${subscriptionId}/attendance`;
        const params = new URLSearchParams();
        if (year) params.append("year", year.toString());
        if (month) params.append("month", month.toString());
        if (params.toString()) url += `?${params.toString()}`;

        const response = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
          },
        });

        if (!response.ok) throw new Error("Failed to fetch attendance");

        const json = await response.json();
        setAttendance(json.data || null);
      } catch (err) {
        console.error("Error fetching attendance:", err);
        setError("Could not load attendance data");
      } finally {
        setLoading(false);
      }
    };

    if (subscriptionId) {
      fetchAttendance();
    }
  }, [subscriptionId, year, month]);

  if (!subscriptionId) {
    return (
      <div className="rounded-lg border border-surface-highest bg-white p-6 text-center text-ink-soft">
        Selecciona una suscripción para ver asistencia
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-surface-highest bg-white p-6 text-center text-ink-soft">
        Cargando asistencia...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!attendance) {
    return (
      <div className="rounded-lg border border-surface-highest bg-white p-6 text-center text-ink-soft">
        Sin datos de asistencia
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-surface-highest bg-white p-6">
      <div className="border-b border-surface-highest pb-4">
        <h3 className="mb-2 text-lg font-semibold text-ink">Asistencia - {attendance.monthName}</h3>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink-soft">Clases asistidas:</span>
            <span className="text-2xl font-bold text-primary">{attendance.attendedCount}</span>
            <span className="text-sm text-ink-soft">de {attendance.totalClasses}</span>
          </div>
          {attendance.totalClasses > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-soft">Asistencia:</span>
              <span className="text-2xl font-bold text-primary">
                {Math.round((attendance.attendedCount / attendance.totalClasses) * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {attendance.records.length > 0 ? (
        <div className="space-y-2">
          <h4 className="font-semibold text-ink">Registro de clases</h4>
          <ul className="space-y-1">
            {attendance.records.map((record) => (
              <li key={record.id} className="flex items-center gap-2 text-sm">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                    record.attended
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {record.attended ? "✓" : "○"}
                </span>
                <span className="text-ink-soft">{record.classDate}</span>
                <span className="text-xs text-ink-soft">
                  {record.attended ? "Asistió" : "No asistió"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-center text-sm text-ink-soft">No hay registros de asistencia</p>
      )}
    </div>
  );
}
