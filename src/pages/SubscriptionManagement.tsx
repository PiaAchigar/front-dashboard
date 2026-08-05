import { useState } from "react";
import { SubscriptionForm } from "../components/SubscriptionForm";
import { SubscriptionTable } from "../components/SubscriptionTable";
import { AttendanceTracker } from "../components/AttendanceTracker";

export function SubscriptionManagement() {
  const [refreshCount, setRefreshCount] = useState(0);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string | null>(null);

  // TODO: Get customerId from auth context or URL params
  const customerId = "test-customer-id";

  const handleFormSuccess = () => {
    setRefreshCount((prev) => prev + 1);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-ink">Gestión de Suscripciones</h1>
        <p className="mt-1 text-ink-soft">Crea y administra suscripciones a actividades mensuales</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Form on the left */}
        <div>
          <SubscriptionForm onSuccess={handleFormSuccess} />
        </div>

        {/* List and Attendance on the right */}
        <div className="space-y-6 lg:col-span-2">
          <div>
            <h2 className="mb-4 text-xl font-semibold text-ink">Suscripciones activas</h2>
            <SubscriptionTable
              customerId={customerId}
              refreshTrigger={refreshCount}
              onSelectSubscription={setSelectedSubscriptionId}
            />
          </div>

          {selectedSubscriptionId && (
            <div>
              <h2 className="mb-4 text-xl font-semibold text-ink">Asistencia</h2>
              <AttendanceTracker subscriptionId={selectedSubscriptionId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
