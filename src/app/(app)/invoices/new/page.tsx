'use client';

import { useTranslation } from 'react-i18next';
import InvoiceEditor from '@/components/InvoiceEditor';
import { PageHeader } from '@/components/ui';

export default function NewInvoicePage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('invoiceEditor.newInvoiceTitle')} subtitle={t('invoiceEditor.newInvoiceSubtitle')} />
      <InvoiceEditor />
    </>
  );
}
