---
name: Hawk Guru Realtor Suite
description: The operating system that turns real-estate conversations into visible next steps.
colors:
  ink: "#09100d"
  panel: "#111a15"
  lime: "#c7ff4d"
  mist: "#dce7d7"
  muted: "#8a9a89"
  line: "#2b3b2d"
  ember: "#ff8868"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Arial, sans-serif"
    fontWeight: 700
    lineHeight: 0.94
  body:
    fontFamily: "Manrope, Arial, sans-serif"
    fontWeight: 400
    lineHeight: 1.55
rounded:
  card: "18px"
  pill: "999px"
spacing:
  compact: "12px"
  standard: "24px"
  expansive: "72px"
components:
  button-primary:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "15px 22px"
---

# Design System: Hawk Guru Realtor Suite

## Overview

**Creative North Star: "The Deal Desk After Dark"**

The surface feels like the real operating desk of a high-performing Realtor: fast, dark, orderly and alive with signals. The green accent is not decorative; it marks momentum, confirmed information and the action that should happen next. The landing rejects generic SaaS glass panels and generic luxury-real-estate imagery in favor of a tangible transaction board.

**Key Characteristics:**
- High-contrast dark field with lime used as operational signal.
- Large, compact grotesk headlines and calm supporting copy.
- Cards behave like evidence files: direct labels, status marks and concrete next actions.
- Motion is restrained and communicates a lead moving through the system.

## Colors

Use the ink field as the durable backdrop; lime indicates action or confirmed progress, while ember is reserved for needs-review states.

### Primary

**Action Lime**: primary calls to action, confirmed signal and active stages.

### Neutral

**Deal Desk Ink**: primary page field and navigation.
- **Panel Green**: elevated content surfaces.
- **Paper Mist**: primary readable text.
- **Muted Ledger**: secondary labels and explanatory text.

### Named Rules

**The Signal Rule.** Lime appears only where the visitor should look, decide or act; it never becomes background decoration across every surface.

## Typography

**Display Font:** Bricolage Grotesque (with Arial fallback)
**Body Font:** Manrope (with Arial fallback)

**Character:** Headlines are decisive and compressed; body copy explains the operational value without hype.

### Hierarchy

- **Display:** bold, compact, clamp-based hero copy for the central promise.
- **Headline:** strong section labels that read like a deal file heading.
- **Body:** comfortable explanatory copy with limited line length.
- **Label:** uppercase, tracked metadata for systems and statuses.

## Layout

The landing uses a wide 12-column field. The hero pairs the commercial promise with a live, illustrative deal desk; later sections alternate dense proof cards with breathing space. Mobile converts the desk into a vertical lead path without hiding the call to action.

## Elevation & Depth

Depth comes from panel contrast, thin ledger lines and offset lime shadows on active controls. Shadows are structural, never soft luxury decoration.

## Shapes

Cards use softly rounded corners while chips and action buttons are pill-shaped. Borders are visible and purposeful, like separators in a transaction folder.

## Components

### Buttons

- **Primary:** action lime, dark text and a crisp offset shadow.
- **Secondary:** transparent with a ledger border.
- **Hover / Focus:** subtle upward shift and visible lime focus ring.

### Cards / Containers

- **Corner Style:** calm rounded rectangle (18px).
- **Background:** panel green on ink.
- **Border:** one-pixel ledger line.

### Navigation

Short wordmark, one focused demo call to action, and no busy marketing menu.

## Do's and Don'ts

### Do:
- **Do** let the operational lead journey prove the product.
- **Do** state human approval and verified-property constraints plainly.
- **Do** keep the first CTA visible in the first viewport.

### Don't:
- **Don't** invent performance metrics, testimonials or customer logos.
- **Don't** use generic mansion photography as a substitute for product proof.
- **Don't** imply that the AI publishes ads, sends campaigns or makes decisions without a Realtor.

---

## Dashboard variant: Private Office

Client workspaces use a separate visual language so the dashboard is recognizably Hawk Guru Realtor Suite rather than a re-labeled generic bot panel. The use scene is a Realtor reviewing a live day of leads and properties in a calm private office.

- **Field:** limestone `#f4f1eb` with white workspace panels.
- **Structure:** ink-blue `#142e3b` slim monogram rail; it replaces the wide command-center sidebar.
- **Signal:** copper `#b85d3f` is reserved for the active destination and primary action. Green remains a semantic success state.
- **Typography:** Manrope is the working UI face. Roboto Mono is reserved for compact operational data.
- **Behavior:** the existing route model, tier gates, data and integrations stay unchanged. Desktop uses a 76px icon rail; mobile keeps an accessible horizontal navigation strip.
