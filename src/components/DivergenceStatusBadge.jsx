import React, { useState, useRef, useEffect } from "react";
import { useDivergenceStatus } from "../hooks/useDivergenceStatus";
import Spinner from "./ui/spinner";

const STATUS_OPTIONS = [
  {
    value: "PENDING",
    label: "Pendente",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200",
  },
  {
    value: "RESOLVED",
    label: "Resolvido",
    color: "bg-green-100 text-green-800 border-green-200 hover:bg-green-200",
  },
  {
    value: "IGNORED",
    label: "Ignorado",
    color: "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200",
  },
  {
    value: "JUSTIFIED",
    label: "Justificado",
    color: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200",
  },
];

export default function DivergenceStatusBadge({ accessKey }) {
  const { status, loading, updateStatus } = useDivergenceStatus(accessKey);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (loading) return <Spinner size="sm" />;

  const currentStatus = status?.status || "PENDING";
  const currentOption =
    STATUS_OPTIONS.find((o) => o.value === currentStatus) || STATUS_OPTIONS[0];

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`px-2 py-1 text-xs font-medium rounded border shadow-sm transition-colors ${currentOption.color}`}
        title="Clique para alterar o status"
      >
        {currentOption.label}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-1 w-32 origin-top-right rounded-md bg-white dark:bg-slate-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none animate-in fade-in zoom-in-95 duration-100">
          <div className="py-1" role="none">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={(e) => {
                  e.stopPropagation();
                  updateStatus(option.value);
                  setIsOpen(false);
                }}
                className={`block w-full px-4 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-slate-700 ${
                  currentStatus === option.value
                    ? "font-bold text-primary"
                    : "text-gray-700 dark:text-gray-200"
                }`}
              >
                <span
                  className={`inline-block w-2 h-2 rounded-full mr-2 ${option.color.split(" ")[0]}`}
                ></span>
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
