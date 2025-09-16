import React, { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import {
  format,
  parse,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isToday,
  isSameDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { clsx } from "clsx";

const DateInput = ({
  value,
  onChange,
  min,
  max,
  placeholder = "Selecione uma data",
  className,
  ...props
}) => {
  const [open, setOpen] = useState(false);

  const getInitialViewDate = () => {
    if (value) {
      try {
        return parse(value, "yyyy-MM-dd", new Date());
      } catch {
        return new Date();
      }
    }
    return new Date();
  };

  const [viewDate, setViewDate] = useState(getInitialViewDate);

  React.useEffect(() => {
    if (value) {
      try {
        const parsedDate = parse(value, "yyyy-MM-dd", new Date());
        setViewDate(parsedDate);
      } catch {
        // ignora
      }
    }
  }, [value]);

  const selectedDate = value ? parse(value, "yyyy-MM-dd", new Date()) : null;

  const handleDateSelect = (date) => {
    const formatted = format(date, "yyyy-MM-dd");
    onChange(formatted);
    setOpen(false);
  };

  const nextMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDayOfWeek = getDay(monthStart);
  const paddingDays = Array.from({ length: startDayOfWeek }, (_, i) => {
    const date = new Date(monthStart);
    date.setDate(date.getDate() - (startDayOfWeek - i));
    return date;
  });

  const displayValue = selectedDate
    ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR })
    : "";

  const isDateDisabled = (date) => {
    if (min) {
      const minDate = parse(min, "yyyy-MM-dd", new Date());
      if (date < minDate) return true;
    }
    if (max) {
      const maxDate = parse(max, "yyyy-MM-dd", new Date());
      if (date > maxDate) return true;
    }
    return false;
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={clsx(
            "w-full h-9 px-3 py-2 text-sm border border-input bg-background rounded-md",
            "focus:ring-2 focus:ring-ring focus:border-transparent transition-colors",
            "flex items-center justify-between text-left",
            "hover:bg-accent hover:text-accent-foreground",
            className
          )}
          {...props}
        >
          <span
            className={
              displayValue ? "text-foreground" : "text-muted-foreground"
            }
          >
            {displayValue || placeholder}
          </span>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="z-50 w-auto p-4 bg-popover text-popover-foreground border border-border rounded-md shadow-lg"
          side="bottom"
          align="start"
          sideOffset={4}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1 hover:bg-accent hover:text-accent-foreground rounded"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h3 className="text-sm font-medium">
                {format(viewDate, "MMMM yyyy", { locale: ptBR })}
              </h3>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1 hover:bg-accent hover:text-accent-foreground rounded"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-xs">
              {["D", "S", "T", "Q", "Q", "S", "S"].map((day, i) => (
                <div
                  key={i}
                  className="h-8 flex items-center justify-center font-medium text-muted-foreground"
                >
                  {day}
                </div>
              ))}

              {paddingDays.map((date, i) => (
                <button
                  key={`padding-${i}`}
                  type="button"
                  className="h-8 text-xs text-muted-foreground/50 hover:bg-accent/50 rounded"
                  onClick={() => handleDateSelect(date)}
                  disabled={isDateDisabled(date)}
                >
                  {date.getDate()}
                </button>
              ))}

              {days.map((date, i) => {
                const isSelected =
                  selectedDate && isSameDay(date, selectedDate);
                const isTodayDate = isToday(date);
                const disabled = isDateDisabled(date);

                return (
                  <button
                    key={i}
                    type="button"
                    className={clsx(
                      "h-8 text-xs rounded transition-colors",
                      disabled && "text-muted-foreground/30 cursor-not-allowed",
                      !disabled &&
                        !isSelected &&
                        "hover:bg-accent hover:text-accent-foreground",
                      isSelected &&
                        "bg-blue-600 text-white hover:bg-blue-700 font-medium shadow-sm",
                      isTodayDate &&
                        !isSelected &&
                        "bg-accent text-accent-foreground font-medium border border-blue-200 dark:border-blue-800"
                    )}
                    onClick={() => !disabled && handleDateSelect(date)}
                    disabled={disabled}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => {
                  const today = format(new Date(), "yyyy-MM-dd");
                  if (!isDateDisabled(new Date())) {
                    onChange(today);
                  }
                  setOpen(false);
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Hoje
              </button>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

export default DateInput;
