import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';
import { Button } from './Button';

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  /**
   * Claim decisions, exclusions and region overrides must be justified: the
   * reason is stored on claim_actions and the audit log, so it is required.
   */
  requireReason?: boolean;
  reasonLabel?: string;
  danger?: boolean;
  loading?: boolean;
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  requireReason = false,
  reasonLabel,
  danger = false,
  loading = false,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setReason('');
      setTouched(false);
    }
  }, [open]);

  const trimmed = reason.trim();
  const invalid = requireReason && trimmed.length < 3;

  async function handleConfirm() {
    setTouched(true);
    if (invalid) return;
    await onConfirm(trimmed);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      closeLabel={t('common.close')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={handleConfirm}
            loading={loading}
            disabled={invalid && touched}
          >
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </>
      }
    >
      {requireReason ? (
        <label className="block">
          <span className="text-sm font-medium text-navy-700">
            {reasonLabel ?? t('common.reason')}{' '}
            <span className="text-accent-red">*</span>
          </span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            onBlur={() => setTouched(true)}
            rows={3}
            required
            aria-invalid={invalid && touched}
            className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm placeholder:text-navy-300 focus:border-navy-400"
            placeholder={t('common.reasonPlaceholder')}
          />
          {invalid && touched ? (
            <span className="mt-1 block text-xs text-status-redfg">
              {t('common.reasonRequired')}
            </span>
          ) : null}
        </label>
      ) : (
        <p className="text-sm text-navy-500">{t('common.confirmBody')}</p>
      )}
    </Modal>
  );
}
