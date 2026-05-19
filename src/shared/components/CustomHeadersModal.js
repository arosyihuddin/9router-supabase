"use client";

import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import Button from "./Button";
import Input from "./Input";
import Modal from "./Modal";
import { normalizeCustomHeaders } from "@/shared/utils/customHeaders";

function rowsFromHeaders(headers) {
  const rows = Object.entries(normalizeCustomHeaders(headers)).map(([name, value]) => ({
    name,
    value,
  }));
  return rows.length ? rows : [{ name: "", value: "" }];
}

export function CustomHeadersPreview({ headers, emptyText = "No custom headers" }) {
  const entries = Object.entries(normalizeCustomHeaders(headers));
  if (!entries.length) {
    return <p className="text-xs text-text-muted">{emptyText}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([name, value]) => (
        <span
          key={name}
          className="inline-flex max-w-full items-center gap-1 rounded border border-border bg-surface-2 px-2 py-1 text-xs text-text-muted"
          title={`${name}: ${value}`}
        >
          <span className="font-medium text-text-main">{name}</span>
          <span className="truncate">: {value}</span>
        </span>
      ))}
    </div>
  );
}

CustomHeadersPreview.propTypes = {
  headers: PropTypes.object,
  emptyText: PropTypes.string,
};

export default function CustomHeadersModal({ isOpen, headers, onSave, onClose }) {
  const [rows, setRows] = useState(rowsFromHeaders(headers));
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setRows(rowsFromHeaders(headers));
      setError("");
    }
  }, [isOpen, headers]);

  const updateRow = (index, field, value) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    setError("");
  };

  const addRow = () => {
    setRows((prev) => [...prev, { name: "", value: "" }]);
  };

  const removeRow = (index) => {
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [{ name: "", value: "" }];
    });
    setError("");
  };

  const handleSave = () => {
    const raw = {};
    const seen = new Set();

    for (const [index, row] of rows.entries()) {
      const name = row.name.trim();
      const value = row.value.trim();
      if (!name && !value) continue;
      if (!name || !value) {
        setError(`Row ${index + 1}: header name and value are required.`);
        return;
      }
      const lower = name.toLowerCase();
      if (seen.has(lower)) {
        setError(`Row ${index + 1}: duplicate header "${name}".`);
        return;
      }
      seen.add(lower);
      raw[name] = value;
    }

    const normalized = normalizeCustomHeaders(raw);
    if (Object.keys(raw).length !== Object.keys(normalized).length) {
      setError("One or more header names are invalid or blocked.");
      return;
    }

    onSave(normalized);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} title="Custom Headers" onClose={onClose} size="lg">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Input
                label={index === 0 ? "Header" : undefined}
                value={row.name}
                onChange={(e) => updateRow(index, "name", e.target.value)}
                placeholder="HTTP-Referer"
              />
              <Input
                label={index === 0 ? "Value" : undefined}
                value={row.value}
                onChange={(e) => updateRow(index, "value", e.target.value)}
                placeholder="https://example.com"
              />
              <Button
                type="button"
                variant="ghost"
                icon="delete"
                onClick={() => removeRow(index)}
                className="h-10 sm:w-10"
              />
            </div>
          ))}
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <Button type="button" variant="secondary" icon="add" onClick={addRow}>
          Add Header
        </Button>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={handleSave} fullWidth>
            Save Headers
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} fullWidth>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

CustomHeadersModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  headers: PropTypes.object,
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
