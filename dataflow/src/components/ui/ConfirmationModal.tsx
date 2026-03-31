import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { Input } from '@/components/ui/Input';
import { useI18n } from '@/i18n/useI18n';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogFooter,
} from './alert-dialog';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    verificationText?: string;
    verificationLabel?: string;
}

export function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText,
    cancelText,
    isDestructive = false,
    verificationText,
    verificationLabel,
}: ConfirmationModalProps) {
    const { t } = useI18n();
    const [inputValue, setInputValue] = React.useState("");
    const [isLoading, setIsLoading] = React.useState(false);
    const resolvedCancelText = cancelText ?? t('common.actions.cancel');
    const resolvedConfirmText = confirmText ?? t('common.actions.confirm');

    React.useEffect(() => {
        if (isOpen) {
            setInputValue("");
            setIsLoading(false);
        }
    }, [isOpen]);

    const isConfirmDisabled = (verificationText && inputValue !== verificationText) || isLoading;

    const handleConfirm = async () => {
        if (isConfirmDisabled) return;

        setIsLoading(true);
        try {
            await onConfirm();
            onClose();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <AlertDialogContent aria-describedby={undefined}>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        {isDestructive && <AlertTriangle className="h-5 w-5 text-destructive" />}
                        {title}
                    </AlertDialogTitle>
                </AlertDialogHeader>

                <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/10 text-destructive text-sm font-medium">
                        {message}
                    </div>

                    {verificationText && (
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {verificationLabel ?? t('common.confirmation.typeToConfirm', { value: verificationText })}
                            </label>
                            <Input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder={verificationText}
                                className="font-mono focus-visible:border-destructive focus-visible:ring-destructive/50"
                                onPaste={(e) => e.preventDefault()}
                            />
                        </div>
                    )}
                </div>

                <AlertDialogFooter>
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        {resolvedCancelText}
                    </Button>
                    <Button
                        variant={isDestructive ? "destructive" : "default"}
                        onClick={handleConfirm}
                        disabled={isConfirmDisabled}
                        className="min-w-[80px]"
                    >
                        {isLoading ? (
                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                {t('common.status.processing')}
                            </div>
                        ) : resolvedConfirmText}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
