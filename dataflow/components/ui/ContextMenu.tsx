import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export type ContextMenuItem =
    | { separator: true }
    | {
        separator?: false;
        label: string;
        icon?: React.ReactNode;
        onClick: () => void;
        danger?: boolean;
    };

interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: y, left: x });
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleScroll = () => {
            onClose();
        };

        document.addEventListener("mousedown", handleClickOutside);
        window.addEventListener("scroll", handleScroll, true);
        window.addEventListener("resize", handleScroll);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            window.removeEventListener("scroll", handleScroll, true);
            window.removeEventListener("resize", handleScroll);
        };
    }, [onClose]);

    // Use useLayoutEffect to measure and adjust position before paint to avoid flicker
    React.useLayoutEffect(() => {
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            let newTop = y;
            let newLeft = x;

            // Check vertical overflow (bottom edge)
            if (y + rect.height > window.innerHeight) {
                newTop = Math.max(0, y - rect.height);
            }

            // Check horizontal overflow (right edge)
            if (x + rect.width > window.innerWidth) {
                newLeft = Math.max(0, x - rect.width);
            }

            setPosition({ top: newTop, left: newLeft });
            setIsVisible(true);
        }
    }, [x, y, items]);

    // Adjust position to keep menu within viewport
    const style: React.CSSProperties = {
        top: position.top,
        left: position.left,
        opacity: isVisible ? 1 : 0, // Hide until positioned
        pointerEvents: isVisible ? 'auto' : 'none'
    };

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-50 min-w-[160px] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
            style={style}
        >
            {items.map((item, index) => (
                <React.Fragment key={index}>
                    {item.separator ? (
                        <div className="my-1 h-px bg-muted" />
                    ) : (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                item.onClick();
                                onClose();
                            }}
                            className={cn(
                                "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                                item.danger && "text-red-600 hover:text-red-600 hover:bg-red-50 focus:text-red-600 focus:bg-red-50"
                            )}
                        >
                            {item.icon && <span className="mr-2 h-4 w-4">{item.icon}</span>}
                            {item.label}
                        </button>
                    )}
                </React.Fragment>
            ))}
        </div>,
        document.body
    );
}
