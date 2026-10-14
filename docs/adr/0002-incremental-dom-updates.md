# 0002 — Preserve interaction state with morphdom

Status: accepted

Date: 2026-10-14

## Context

Snapshots update every five seconds. Replacing the main DOM discards node identity, keyboard focus and expanded narrative sections. Hand-written focus restoration covers only part of the interaction state. The operator proposed morphdom; its current 2.7.8 API supports keyed DOM-to-DOM patching and update hooks.

## Decision

Use morphdom 2.7.8 to patch a detached, safely constructed DOM into the existing main region. Give agents, assignments, events and evidence stable keys. Refresh click handlers on retained nodes to bind current records. Preserve expanded details. Keep toolbar inputs and the evidence drawer outside the patched region. Load the installed UMD asset inline from the local dependency at launch, never from a CDN and never as a vendored file. Continue creating report content with textContent; morphdom provides no sanitization.

## Consequences

Polling preserves retained node identity and interaction state without a frontend framework or build server. Regression checks must prove focus, expanded sections, scroll, updated handlers and evidence drawer isolation. Keys must remain stable and unique. Changes to rendering need both browser and native WebKit verification.

Source: https://github.com/patrick-steele-idem/morphdom#api
