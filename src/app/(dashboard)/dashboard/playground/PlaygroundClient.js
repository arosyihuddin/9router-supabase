"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Select } from "@/shared/components";
import { AI_PROVIDERS, getProviderByAlias } from "@/shared/constants/providers";

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function groupModels(models, prefixToName) {
  const groups = new Map();
  for (const model of models) {
    const id = model?.id;
    if (!id) continue;
    const owner = model.owned_by || id.split("/")[0] || "models";
    if (!groups.has(owner)) groups.set(owner, []);
    groups.get(owner).push(model);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => getProviderDisplayName(a, prefixToName).localeCompare(getProviderDisplayName(b, prefixToName)))
    .map(([owner, items]) => ({
      owner,
      providerName: getProviderDisplayName(owner, prefixToName),
      models: items.sort((a, b) => a.id.localeCompare(b.id)),
    }));
}

function getProviderDisplayName(owner, prefixToName) {
  if (prefixToName?.[owner]) return prefixToName[owner];
  const provider = getProviderByAlias(owner) || AI_PROVIDERS[owner];
  return provider?.name || owner || "models";
}

function getModelDisplayName(modelId) {
  if (!modelId) return "";
  const parts = String(modelId).split("/");
  return parts.length > 1 ? parts.slice(1).join("/") : modelId;
}

function usageText(usage) {
  if (!usage) return "";
  const input = usage.prompt_tokens ?? usage.input_tokens;
  const output = usage.completion_tokens ?? usage.output_tokens;
  const total = usage.total_tokens;
  return [
    input != null ? `${input} in` : null,
    output != null ? `${output} out` : null,
    total != null ? `${total} total` : null,
  ].filter(Boolean).join(" · ");
}

export default function PlaygroundClient() {
  const [models, setModels] = useState([]);
  const [providerNodes, setProviderNodes] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [modelQuery, setModelQuery] = useState("");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [draft, setDraft] = useState("Reply with one short sentence confirming this model works.");
  const [temperature, setTemperature] = useState("0.2");
  const [maxTokens, setMaxTokens] = useState("256");
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelError, setModelError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState([]);
  const [lastResult, setLastResult] = useState(null);
  const [paramsOpen, setParamsOpen] = useState(false);
  const scrollRef = useRef(null);
  const modelMenuRef = useRef(null);
  const modelSearchRef = useRef(null);

  const loadModels = async () => {
    setLoadingModels(true);
    setModelError("");
    try {
      const [modelsRes, nodesRes] = await Promise.all([
        fetch("/v1/models", { cache: "no-store" }),
        fetch("/api/provider-nodes", { cache: "no-store" }).catch(() => null),
      ]);
      const data = await modelsRes.json().catch(() => ({}));
      if (!modelsRes.ok) throw new Error(data?.error?.message || data?.error || "Failed to load models");
      const nextModels = Array.isArray(data.data) ? data.data : [];
      setModels(nextModels);
      setSelectedModel((current) => current || nextModels[0]?.id || "");

      if (nodesRes && nodesRes.ok) {
        const nodesData = await nodesRes.json().catch(() => ({}));
        setProviderNodes(Array.isArray(nodesData.nodes) ? nodesData.nodes : []);
      } else {
        setProviderNodes([]);
      }
    } catch (error) {
      setModelError(error.message || "Failed to load models");
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target)) {
        setModelMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setModelMenuOpen(false);
      }
    };

    if (modelMenuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("mousedown", handleOutsideClick);
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [modelMenuOpen]);

  useEffect(() => {
    if (!modelMenuOpen) return;
    const timer = window.setTimeout(() => modelSearchRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [modelMenuOpen]);

  const prefixToName = useMemo(() => {
    const map = {};
    for (const node of providerNodes) {
      if (node?.prefix && node?.name) map[node.prefix] = node.name;
    }
    return map;
  }, [providerNodes]);

  const selected = models.find((model) => model.id === selectedModel);
  const selectedProviderName = selected ? getProviderDisplayName(selected.owned_by || selected.id.split("/")[0], prefixToName) : "";
  const selectedShortName = getModelDisplayName(selected?.id || "");
  const menuGroups = useMemo(() => groupModels(models.filter((model) => {
    const q = modelQuery.trim().toLowerCase();
    if (!q) return true;
    const providerName = getProviderDisplayName(model.owned_by || model.id.split("/")[0], prefixToName);
    const shortName = getModelDisplayName(model.id);
    return [
      model.id,
      shortName,
      model.owned_by,
      providerName,
    ].some((value) => String(value || "").toLowerCase().includes(q));
  }), prefixToName), [models, modelQuery, prefixToName]);

  const sendMessage = async () => {
    const content = draft.trim();
    if (!selectedModel || !content || isSending) return;

    const userMessage = {
      id: createId(),
      role: "user",
      content,
      model: selectedModel,
      createdAt: new Date().toISOString(),
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft("");
    setIsSending(true);
    setLastResult(null);

    try {
      const res = await fetch("/api/playground/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          temperature: Number(temperature),
          maxTokens: Number(maxTokens),
        }),
      });
      const data = await res.json().catch(() => ({}));
      setLastResult({ ...data, httpStatus: res.status });

      const assistantMessage = {
        id: createId(),
        role: "assistant",
        content: data.ok ? (data.text || "(empty response)") : (data.error || "Request failed"),
        model: selectedModel,
        ok: !!data.ok,
        latencyMs: data.latencyMs,
        usage: data.usage || null,
        createdAt: new Date().toISOString(),
      };
      setMessages((current) => [...current, assistantMessage]);
    } catch (error) {
      const assistantMessage = {
        id: createId(),
        role: "assistant",
        content: error.message || "Request failed",
        model: selectedModel,
        ok: false,
        createdAt: new Date().toISOString(),
      };
      setLastResult({ ok: false, error: assistantMessage.content });
      setMessages((current) => [...current, assistantMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setLastResult(null);
  };

  return (
    <div className="flex min-w-0 flex-col gap-5 px-1 sm:px-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Model Playground</h1>
          <p className="mt-1 text-sm text-text-muted">Chat with any exposed model and inspect latency, token usage, and errors.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" icon="delete" onClick={clearChat} disabled={messages.length === 0 || isSending}>
            Clear Chat
          </Button>
          <Button variant="secondary" icon="refresh" onClick={loadModels} disabled={loadingModels}>
            {loadingModels ? "Loading..." : "Refresh Models"}
          </Button>
        </div>
      </div>

      {modelError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {modelError}
        </div>
      )}

      <div className="grid min-h-[calc(100vh-11rem)] min-w-0 gap-4">
        <section className="flex min-h-[34rem] min-w-0 flex-col rounded-lg border border-border bg-surface">
          <div className="border-b border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={selected ? "success" : "default"}>{selected ? "Ready" : "No model"}</Badge>
              {selectedProviderName && <Badge variant="default">{selectedProviderName}</Badge>}
              {lastResult?.latencyMs != null && <Badge variant={lastResult.ok ? "success" : "error"}>{lastResult.latencyMs} ms</Badge>}
              {usageText(lastResult?.usage) && <Badge variant="default">{usageText(lastResult.usage)}</Badge>}
            </div>
            <div className="mt-3 flex flex-col gap-3">
              <div className="relative" ref={modelMenuRef}>
                <label className="mb-1 block text-sm font-medium text-text-main">Model</label>
                <button
                  type="button"
                  onClick={() => setModelMenuOpen((value) => !value)}
                  className="flex w-full items-center justify-between gap-3 rounded-[10px] border border-border bg-background px-3 py-2.5 text-left text-sm text-text-main transition-colors hover:border-brand-500/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {selectedProviderName || "Select a model"}
                    </span>
                    {selectedShortName && (
                      <span className="block truncate text-xs text-text-muted">{selectedShortName}</span>
                    )}
                  </span>
                  <span className="material-symbols-outlined text-[20px] text-text-muted">
                    {modelMenuOpen ? "expand_less" : "expand_more"}
                  </span>
                </button>

                {modelMenuOpen && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
                    <div className="border-b border-border p-3">
                      <input
                        ref={modelSearchRef}
                        value={modelQuery}
                        onChange={(e) => setModelQuery(e.target.value)}
                        placeholder="Search model or provider..."
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-main outline-none focus:border-primary"
                      />
                    </div>
                    <div className="max-h-80 overflow-y-auto p-2 custom-scrollbar">
                      {menuGroups.length === 0 ? (
                        <p className="p-3 text-sm text-text-muted">No models found.</p>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {menuGroups.map((group) => (
                            <div key={group.owner} className="flex flex-col gap-1">
                              <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">{group.providerName}</p>
                              {group.models.map((model) => (
                                <button
                                  key={model.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedModel(model.id);
                                    setModelMenuOpen(false);
                                  }}
                                  className={`min-w-0 rounded px-2 py-2 text-left text-xs transition-colors ${
                                    selectedModel === model.id
                                      ? "bg-primary/10 text-primary"
                                      : "text-text-main hover:bg-surface-2"
                                  }`}
                                >
                                  <span className="block truncate font-medium">{getModelDisplayName(model.id)}</span>
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setParamsOpen((value) => !value)}
                  className="flex items-center justify-between gap-2 rounded-[10px] border border-border bg-background px-3 py-2 text-left text-sm text-text-main transition-colors hover:border-brand-500/40"
                >
                  <span className="font-medium">Parameters</span>
                  <span className="flex items-center gap-2 text-xs text-text-muted">
                    <span>temp {temperature} · max {maxTokens}</span>
                    <span className="material-symbols-outlined text-[20px]">
                      {paramsOpen ? "expand_less" : "expand_more"}
                    </span>
                  </span>
                </button>
                {paramsOpen && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Select
                      label="Temperature"
                      value={temperature}
                      onChange={(e) => setTemperature(e.target.value)}
                      options={[
                        { value: "0", label: "0" },
                        { value: "0.2", label: "0.2" },
                        { value: "0.7", label: "0.7" },
                        { value: "1", label: "1" },
                      ]}
                    />
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-text-main">Max Tokens</label>
                      <input
                        type="number"
                        min="1"
                        max="8192"
                        value={maxTokens}
                        onChange={(e) => setMaxTokens(e.target.value)}
                        className="w-full rounded-[10px] border border-transparent bg-surface-2 px-3 py-2.5 text-sm text-text-main outline-none focus:border-brand-500/40 focus:ring-2 focus:ring-brand-500/30"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-background/40 p-4 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="flex h-full min-h-[18rem] items-center justify-center text-center">
                <div className="max-w-sm">
                  <span className="material-symbols-outlined mb-3 block text-[32px] text-text-muted">forum</span>
                  <p className="text-sm font-medium text-text-main">Start a model test chat</p>
                  <p className="mt-1 text-sm text-text-muted">Pick a model, send a message, then continue the conversation to test context handling.</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {messages.map((message) => {
                  const isUser = message.role === "user";
                  return (
                    <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[min(48rem,85%)] rounded-lg px-3 py-2 text-sm shadow-sm ${
                        isUser
                          ? "bg-primary text-white"
                          : message.ok === false
                            ? "border border-red-500/30 bg-red-500/10 text-red-500"
                            : "border border-border bg-surface text-text-main"
                      }`}>
                        <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] opacity-80">
                          <span className="font-semibold">{isUser ? "You" : "Assistant"}</span>
                          {!isUser && message.latencyMs != null && <span>{message.latencyMs} ms</span>}
                          {!isUser && usageText(message.usage) && <span>{usageText(message.usage)}</span>}
                        </div>
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                      </div>
                    </div>
                  );
                })}
                {isSending && (
                  <div className="flex justify-start">
                    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-muted shadow-sm">
                      Thinking...
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-border p-3">
            <div className="flex flex-col gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                rows={3}
                placeholder="Message the selected model..."
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-main outline-none focus:border-primary"
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-text-muted">Ctrl/⌘ + Enter to send</span>
                <Button icon="send" onClick={sendMessage} disabled={!selectedModel || !draft.trim() || isSending}>
                  {isSending ? "Sending..." : "Send"}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
