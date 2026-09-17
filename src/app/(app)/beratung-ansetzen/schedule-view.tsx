'use client';

import { useState } from 'react';
import { CustomerPicker } from './customer-picker';
import { NewCustomerForm } from './new-customer-form';
import type { CustomerListItem } from '@/features/customers/queries';

export function ScheduleView({ customers }: { customers: readonly CustomerListItem[] }) {
  // Kein zweiter Seitenaufruf fuer den Wechsel: die Auswahl und das
  // Formular gehoeren zur selben Handlung, und ein Seitenwechsel dazwischen
  // wuerde die Eingaben verlieren.
  const [mode, setMode] = useState<'pick' | 'new'>(customers.length === 0 ? 'new' : 'pick');

  return mode === 'pick'
    ? <CustomerPicker customers={customers} onNew={() => setMode('new')} />
    : <NewCustomerForm onBack={() => setMode('pick')} />;
}
