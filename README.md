# ShapeMerge - Liquid Glass Effect Library

A high-performance, pixel-perfect recreation of the "Liquid Glass" effect using WebGL 2.0 and React. This library creates a fluid, glass-like distortion effect that merges UI elements with a custom cursor.

## Features

*   **Zero Dependencies**: Built with raw WebGL 2.0 and React. No Three.js or OGL required.
*   **High Performance**: Optimized with DPR capping, downscaled blur passes, and SDF bounding box checks.
*   **Customizable**: Over 20 parameters to tweak refraction, reflection, glare, shadows, and blur.
*   **Drop-in Ready**: Self-contained folder structure. Just copy and paste.
*   **Custom Cursor**: Includes a monochrome, blend-mode inverting cursor that interacts with clickable elements.

## Installation

1.  **Copy the Folder**: Copy the entire `ShapeMerge` folder into your project (e.g., `src/components/ShapeMerge`).
2.  **Install React**: Ensure you have React installed (you likely already do).

```bash
npm install react react-dom
```

## Usage

Wrap your application (or the section where you want the effect) with `ShapeMergeProvider`. Use `ShapeMergeCard` for elements that should participate in the liquid effect.

```tsx
import { ShapeMergeProvider, ShapeMergeCard, CustomCursor } from './components/ShapeMerge';

function App() {
  return (
    // 1. The Provider renders the WebGL canvas background
    <ShapeMergeProvider>
      
      {/* 2. Optional: Adds the interactive monochrome cursor */}
      <CustomCursor />
      
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        
        {/* 3. Any content inside ShapeMergeCard will have the glass effect behind it */}
        <ShapeMergeCard style={{ padding: '40px', color: 'white' }}>
          <h1>Liquid Glass</h1>
          <p>Hover over me!</p>
        </ShapeMergeCard>
        
      </div>
    </ShapeMergeProvider>
  );
}
```

## Components

### `<ShapeMergeProvider />`

The main container. It creates the full-screen WebGL canvas.

*   **Props**:
    *   `initialSettings` (optional): Partial `ShapeMergeSettings` object to override defaults.
    *   `children`: Your app content.

### `<ShapeMergeCard />`

A wrapper for UI elements that should "merge" with the liquid effect.

*   **Props**:
    *   `cornerRadius` (number, default: 20): The border radius of the shape in the SDF.
    *   All standard `HTMLDivElement` props (style, className, etc.).
*   **Note**: The background of this card is transparent by default to show the glass effect.

### `<CustomCursor />`

A custom cursor component that replaces the system cursor.

*   **Features**:
    *   Monochrome (Difference Blend Mode).
    *   Ring shape.
    *   Fills with white when hovering over clickable elements (buttons, links, pointer cursor).

## Configuration

You can configure the effect by passing `initialSettings` to the provider, or by using the `useShapeMergeContext` hook to update settings at runtime.

```tsx
const { updateSettings } = useShapeMergeContext();
updateSettings({ blurRadius: 10 });
```

### Settings Reference

| Category | Property | Type | Default | Description |
|----------|----------|------|---------|-------------|
| **Glass** | `refThickness` | 1-80 | 20 | Thickness of the glass refraction edge. |
| | `refFactor` | 1-4 | 1.4 | Strength of the refraction distortion. |
| | `refDispersion` | 0-50 | 7 | Chromatic aberration amount (RGB split). |
| **Lighting** | `refFresnelRange` | 0-100 | 30 | Range of the edge reflection. |
| | `refFresnelHardness` | 0-100 | 20 | Sharpness of the edge reflection. |
| | `refFresnelFactor` | 0-100 | 20 | Intensity of the edge reflection. |
| **Glare** | `glareRange` | 0-100 | 30 | Size of the specular highlight. |
| | `glareHardness` | 0-100 | 20 | Sharpness of the highlight. |
| | `glareFactor` | 0-120 | 90 | Intensity of the main highlight. |
| | `glareAngle` | -180 to 180 | -45 | Angle of the light source. |
| | `glareConvergence` | 0-100 | 50 | Focus of the specular highlight. |
| | `glareOppositeFactor` | 0-100 | 80 | Intensity of the secondary (opposite) highlight. |
| **Blur** | `blurRadius` | 1-200 | 1 | Background blur amount. |
| **Shape** | `mergeRate` | 0-0.3 | 0.05 | Distance at which shapes start to merge. |
| | `roundness` | 2-7 | 5.0 | Superellipse factor (higher = squarer). |
| | `cursorRadius` | 0-100 | 25.0 | Radius of the mouse cursor influence. |
| **Colors** | `tint` | Hex | #ffffff | Color tint applied to the glass. |
| | `tintAlpha` | 0-1 | 0.0 | Opacity of the tint. |
| | `saturation` | 0-2 | 1.0 | Saturation of the background seen through glass. |
| | `brightness` | 0-2 | 1.0 | Brightness of the background seen through glass. |
| **Shadow** | `shadowExpand` | 2-100 | 25 | Softness/Spread of the shadow. |
| | `shadowFactor` | 0-100 | 15 | Opacity of the shadow. |
| | `shadowOffset` | {x, y} | {0, -10} | Direction of the shadow. |
| **Background** | `backgroundImage` | URL | (Unsplash) | URL of the background image to blur/refract. |

## Performance Tips

*   **DPR Capping**: The library automatically caps the Device Pixel Ratio at 2.0 to prevent performance issues on high-density Retina displays.
*   **Blur Downscaling**: The background blur is calculated at 0.5x resolution to save GPU cycles.
*   **Bounding Box**: SDF calculations are skipped for pixels far away from shapes.

## License

MIT
