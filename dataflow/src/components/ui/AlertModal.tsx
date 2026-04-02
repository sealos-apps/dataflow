import { CheckCircle, AlertCircle, Info } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/useI18n';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from './dialog';

interface AlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: 'success' | 'error' | 'info';
    buttonText?: string;
}

export function AlertModal({
    isOpen,
    onClose,
    title,
    message,
    type = 'info',
    buttonText
}: AlertModalProps) {
    const { t } = useI18n();
    const resolvedButtonText = buttonText ?? t('common.actions.ok');

    const getIcon = () => {
        switch (type) {
            case 'success':
                return <CheckCircle className="h-5 w-5 text-success" />;
            case 'error':
                return <AlertCircle className="h-5 w-5 text-destructive" />;
            default:
                return <Info className="h-5 w-5 text-primary" />;
        }
    };

    const getButtonVariant = () => {
        switch (type) {
            case 'success':
                return 'default' as const;
            case 'error':
                return 'destructive' as const;
            default:
                return 'default' as const;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-sm gap-0 p-0" showCloseButton={false} aria-describedby={undefined}>
                <DialogHeader className="flex-row items-center justify-between px-6 py-4 border-b space-y-0">
                    <DialogTitle className="flex items-center gap-2">
                        {getIcon()}
                        {title}
                    </DialogTitle>
                </DialogHeader>

                <div className="p-6">
                    <div className={cn(
                        "p-4 rounded-lg text-sm font-medium border whitespace-pre-wrap",
                        type === 'success' && "bg-success/5 border-success/10 text-success",
                        type === 'error' && "bg-destructive/5 border-destructive/10 text-destructive",
                        type === 'info' && "bg-muted/50 border-border text-muted-foreground"
                    )}>
                        {message}
                    </div>
                </div>

                <DialogFooter className="px-6 py-4 border-t bg-muted/20 rounded-b-xl">
                    <Button
                        variant={getButtonVariant()}
                        onClick={onClose}
                        className="min-w-[80px]"
                    >
                        {resolvedButtonText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
