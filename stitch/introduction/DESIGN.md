---
name: Matte Clay Aesthetic
colors:
  surface: '#f6f9ff'
  surface-dim: '#d5dae1'
  surface-bright: '#f6f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4fb'
  surface-container: '#e9eef5'
  surface-container-high: '#e4e9f0'
  surface-container-highest: '#dee3ea'
  on-surface: '#171c21'
  on-surface-variant: '#41474e'
  inverse-surface: '#2b3136'
  inverse-on-surface: '#ecf1f8'
  outline: '#72787f'
  outline-variant: '#c1c7cf'
  surface-tint: '#30628a'
  primary: '#30628a'
  on-primary: '#ffffff'
  primary-container: '#a2d2ff'
  on-primary-container: '#275b82'
  inverse-primary: '#9bcbf8'
  secondary: '#8a4a64'
  on-secondary: '#ffffff'
  secondary-container: '#ffb0cd'
  on-secondary-container: '#7c3f58'
  tertiary: '#7e5713'
  on-tertiary: '#ffffff'
  tertiary-container: '#fac477'
  on-tertiary-container: '#764f0b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cde5ff'
  primary-fixed-dim: '#9bcbf8'
  on-primary-fixed: '#001d32'
  on-primary-fixed-variant: '#104a70'
  secondary-fixed: '#ffd9e4'
  secondary-fixed-dim: '#ffb0cd'
  on-secondary-fixed: '#390720'
  on-secondary-fixed-variant: '#6e334c'
  tertiary-fixed: '#ffddb2'
  tertiary-fixed-dim: '#f3bd71'
  on-tertiary-fixed: '#291800'
  on-tertiary-fixed-variant: '#624000'
  background: '#f6f9ff'
  on-background: '#171c21'
  surface-variant: '#dee3ea'
  mint-macaron: '#B7E4C7'
  charcoal-text: '#4A5568'
  surface-highlight: '#FFFFFF'
  surface-shadow: '#BFC9D4'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  container-max: 1200px
  gutter: 24px
---

## Brand & Style

This design system focuses on a sophisticated evolution of Claymorphism, moving away from plastic gloss toward a high-end, matte "macaron" finish. The brand personality is playful yet premium, targeting creative professionals and lifestyle-oriented users who appreciate tactile, iOS-inspired interfaces.

The design style is **Tactile / Minimalist**, characterized by "inflated" UI elements that feel soft to the touch. By combining large-radius outer shadows with complex inner shadows, the interface achieves a 3D volumetric quality that feels both substantial and weightless. The aesthetic is friendly, calm, and highly refined, avoiding the harshness of traditional flat design in favor of organic, rounded forms.

## Colors

The color palette is inspired by a "Macaron" aesthetic: muted, high-brightness pastels that provide a sense of lightness.

- **Primary & Secondary:** Soft sky blue and dusty rose serve as the main action and accent colors.
- **Neutral:** A warm, desaturated light gray (`#E0E5EC`) acts as the canvas, providing the necessary depth for the clay effect to manifest.
- **Surface Rendering:** Avoid pure blacks. Use `charcoal-text` for readability and `surface-shadow` for the foundational depth of the "inflated" components.
- **Tone:** All colors should maintain a matte, non-reflective finish. Vibrancy is achieved through brightness rather than saturation.

## Typography

This design system utilizes **Plus Jakarta Sans** across all levels to maintain a clean, modern, and slightly rounded geometric appearance that complements the soft UI shapes.

- **Scale:** Headlines use tight letter spacing and bold weights to ground the soft visual elements.
- **Hierarchy:** Use `display-lg` sparingly for hero sections. Body copy remains legible with generous line heights to ensure the interface feels airy.
- **Contrast:** While the UI is pastel, the typography uses `charcoal-text` to ensure high accessibility and a professional "iOS" editorial feel.

## Layout & Spacing

The layout follows a **Fluid Grid** model with generous margins to reinforce the "floating" nature of the components. 

- **Grid:** A 12-column system for desktop, transitioning to a single column for mobile. 
- **Rhythm:** An 8px base unit drives all padding and margins. 
- **Breathing Room:** Objects should never feel crowded. Use `lg` (48px) or `xl` (80px) vertical spacing between major sections to emphasize the minimalist, "clay" objects.
- **Margins:** Desktop layouts should maintain a minimum of 48px side margins to keep content centered and focused.

## Elevation & Depth

Depth is the core differentiator of this design system. It is achieved through a triple-layer shadow technique:

1.  **Outer Shadow:** A large-radius, low-opacity drop shadow (e.g., `blur: 40px`, `y: 20px`, `color: rgba(0,0,0,0.08)`) makes elements appear to float high above the background.
2.  **Inner Highlight (Top-Left):** A crisp, white or light-tinted inner shadow (e.g., `blur: 8px`, `x: -4px`, `y: -4px`) creates the "inflated" upper edge.
3.  **Inner Shadow (Bottom-Right):** A deep, tinted inner shadow (using a darker version of the component's own color, e.g., `blur: 12px`, `x: 6px`, `y: 6px`) provides the structural volume.

The result is a soft, matte finish that looks like molded clay rather than shiny plastic.

## Shapes

The shape language is **extremely rounded (Pill-shaped)**. This removes all "sharpness" from the interface, reinforcing the safe, tactile brand personality.

- **Buttons & Inputs:** Use full pill-shaped radius (rounding equal to half the height).
- **Cards:** Use `rounded-xl` (3rem / 48px) to maintain the "lozenge" aesthetic.
- **Icons:** Should feature rounded terminals and thick strokes (2px+) to match the weight of the typography and components.

## Components

- **Buttons:** Primary buttons use `primary-color` with the full claymorphism shadow stack. On hover, the inner shadows should slightly deepen to simulate a "pressing" effect.
- **Input Fields:** These should appear "sunken" or "inset." Reverse the shadow logic: outer shadows are removed, and inner shadows are darkened on the top-left to create a concave effect.
- **Cards:** Use the `neutral-color` as the card base. Cards should have the most dramatic outer shadows to define the main content hierarchy.
- **Chips:** Small, pill-shaped badges using `named_colors` (like Mint or Rose) with subtle 1px white inner highlights to maintain the "inflated" look at a small scale.
- **Lists:** Items should be separated by whitespace rather than lines. Each list item can be its own subtle "clay" tile or sit on a shared card background.
- **Checkboxes/Radios:** These should look like small "clay" buttons. When selected, they transition to a vibrant pastel color with a prominent inner highlight.