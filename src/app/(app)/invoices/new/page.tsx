import InvoiceEditor from '@/components/InvoiceEditor';
import { PageHeader } from '@/components/ui';

export default function NewInvoicePage() {
  return (
    <>
      <PageHeader title="New invoice" subtitle="Pick a preset, add your lines, save." />
      <InvoiceEditor />
    </>
  );
}
