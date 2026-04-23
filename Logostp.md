# Design System Specification: Atmospheric Etherealism

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Lucid Horizon."** 

Unlike traditional flat design which relies on rigid grids and clinical separation, this system treats the interface as a physical environment of light and air. We are not just building layouts; we are sculpting light through "glass" surfaces. By utilizing high-transparency panels, deep background blurs, and intentional asymmetry, we move away from the "template" look toward an editorial experience that feels organic and premium. 

Key design pillars include:
*   **Weightless Depth:** Layers should feel like they are floating in a soft sky, not anchored to a grid.
*   **Luminous Interaction:** Every touchpoint should feel like a shift in light or focus.
*   **Intentional Asymmetry:** Use varying card widths and overlapping elements to break the "boxy" feel of standard web layouts.

---

## 2. Colors
Our palette is anchored in the transition between a sky-blue atmosphere and high-energy kinetic accents.

### The Color Logic
*   **Primary (`#9b3f00` / `#ff7a2e`):** Reserved strictly for high-priority actions. It is the "sunset" on our horizon.
*   **Secondary (`#17618b`):** Used for deep contrast, primarily in text or specialized UI accents to ground the airy glass elements.
*   **Surface Hierarchy:** We utilize `surface-container-lowest` through `highest` to define depth.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders for sectioning or layout containment. Structural boundaries must be defined solely through background color shifts or the physical separation of glass panels. For example, a `surface-container-low` panel sitting on a `surface` background provides all the definition required.

### Surface Hierarchy & Nesting
Treat the UI as a series of nested physical layers:
1.  **Base Layer:** The soft sky-blue background with organic cloud shapes.
2.  **Parent Container:** A large glass panel using a semi-transparent `surface-container-lowest` with a `backdrop-filter: blur(40px)`.
3.  **Nested Elements:** Small cards or input fields inside the parent container use `surface-container-highest` at 40% opacity to create a "recessed" or "lifted" look without lines.

### The "Glass & Gradient" Rule
To ensure CTAs feel premium, avoid flat fills. Use a subtle linear gradient on primary buttons (e.g., `primary` to `primary-container`) to provide a "soul" and professional polish. For floating panels, always use `backdrop-filter` to allow the background clouds to bleed through, softening the interface.

---

## 3. Typography
We utilize **Plus Jakarta Sans** for its modern, clean, and approachable geometric weight.

*   **Editorial Expression:** Use `display-lg` and `display-md` for hero sections with wide tracking and generous leading.
*   **The Hierarchy:**
    *   **Display/Headline:** Use `on-surface` or `on-secondary` for maximum legibility. These should feel authoritative.
    *   **Body:** `body-lg` is your workhorse. Ensure a line height that allows the background "atmosphere" to breathe through the text.
    *   **Labels:** Use `label-md` in all-caps with increased letter spacing for a "technical-luxe" feel on chips and small tags.

The contrast between the oversized headlines and the delicate glass containers creates the signature high-end editorial look.

---

## 4. Elevation & Depth
Depth is achieved through **Tonal Layering**, not structural shadows.

### The Layering Principle
Stack your surfaces to create natural lift. Place a `surface-container-lowest` card on a `surface-container-low` section. This creates a soft, sophisticated edge-case that feels more expensive than a standard drop shadow.

### Ambient Shadows
When an element must "float" (like a modal or a floating action button), use **Ambient Shadows**. 
*   **Specs:** Blur: 40px–60px, Opacity: 4%–8%. 
*   **Color:** Use a tinted version of `on-surface` or `secondary-dim` rather than pure black to simulate how light reflects off the blue sky.

### The "Ghost Border" Fallback
If accessibility requires a border, use a **Ghost Border**.
*   **Token:** `outline-variant` at 15% opacity.
*   **Rule:** Never use 100% opaque borders. The goal is a "shimmer" on the edge of the glass, not a cage around the content.

---

## 5. Components

### Buttons
*   **Primary:** Rounded `full`. Gradient fill from `primary` to `primary-fixed-dim`. Subtle white `inner-glow` (top border-radius only).
*   **Secondary/Glass:** `surface-container-lowest` at 20% opacity with a heavy `backdrop-blur`. Use `on-surface` text.

### Cards & Lists
*   **Forbid Divider Lines:** Separate list items using `8px` of vertical white space or a 5% tonal shift in the background color. 
*   **Corner Radii:** Use `xl` (1.5rem) for main containers and `lg` (1rem) for internal nested cards. This "radius nesting" creates visual harmony.

### Input Fields
*   **Styling:** Semi-transparent `surface-container-highest` (20% opacity). 
*   **Focus State:** Instead of a heavy border, increase the `backdrop-blur` intensity and use a `Ghost Border` of `primary` at 30% opacity.

### Chips
*   **Selection:** Use `secondary-container` with `on-secondary-container` text.
*   **Shape:** Always `full` roundedness to mimic organic pebbles.

---

## 6. Do's and Don'ts

### Do:
*   **Do** allow background elements (clouds) to be partially visible through the UI panels.
*   **Do** use asymmetrical margins to create an editorial, "non-app" feel.
*   **Do** use the `xl` and `full` roundedness tokens to maintain a soft, friendly aesthetic.
*   **Do** treat white space as a functional element that guides the eye.

### Don't:
*   **Don't** use 1px solid black or high-contrast borders.
*   **Don't** use pure black (`#000000`) for shadows; it kills the "atmospheric" feel. Use `secondary-dim` tints.
*   **Don't** crowd the glass panels. If the content feels tight, increase the container size or reduce the content. Glass needs room to "glow."
*   **Don't** use hard-edged, non-rounded corners. Everything in this system should feel tumbled and soft.

---

## 7. Tokens Reference

### Roundedness Scale
*   **Containers:** `xl` (1.5rem)
*   **Cards/Inputs:** `lg` (1rem)
*   **Buttons/Chips:** `full` (9999px)

### Key Color Tokens
*   **Action:** `primary` (#9b3f00) / `primary-container` (#ff7a2e)
*   **Contrast:** `secondary` (#17618b)
*   **Glass Base:** `surface-container-lowest` (#ffffff) with alpha transparency (20%-60%).