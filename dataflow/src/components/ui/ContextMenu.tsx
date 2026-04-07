import React from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./dropdown-menu";

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
    side?: "top" | "right" | "bottom" | "left";
    align?: "start" | "end";
}

export function ContextMenu({ x, y, items, onClose, side = "bottom", align = "start" }: ContextMenuProps) {
    return (
        <DropdownMenu open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DropdownMenuTrigger asChild>
                <span style={{ position: "fixed", top: y, left: x, width: 0, height: 0 }} />
            </DropdownMenuTrigger>
            <DropdownMenuContent
                side={side}
                align={align}
                sideOffset={0}
                className="w-[152px]"
                onCloseAutoFocus={(e) => e.preventDefault()}
            >
                {items.map((item, index) => (
                    <React.Fragment key={index}>
                        {item.separator ? (
                            <DropdownMenuSeparator />
                        ) : (
                            <DropdownMenuItem
                                variant={item.danger ? "destructive" : "default"}
                                onSelect={item.onClick}
                            >
                                {item.icon}
                                {item.label}
                            </DropdownMenuItem>
                        )}
                    </React.Fragment>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
