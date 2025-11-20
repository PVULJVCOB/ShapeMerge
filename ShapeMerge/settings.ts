export interface ShapeMergeSettings {
  // Glass Properties
  refThickness: number; // 1 to 80
  refFactor: number; // 1 to 4
  refDispersion: number; // 0 to 50
  
  // Lighting / Fresnel
  refFresnelRange: number; // 0 to 100
  refFresnelHardness: number; // 0 to 100
  refFresnelFactor: number; // 0 to 100
  
  // Glare (Specular)
  glareRange: number; // 0 to 100
  glareHardness: number; // 0 to 100
  glareFactor: number; // 0 to 120
  glareAngle: number; // -180 to 180
  glareConvergence: number; // 0 to 100
  glareOppositeFactor: number; // 0 to 100
  
  // Blur
  blurRadius: number; // 1 to 200
  
  // Shape
  mergeRate: number; // 0 to 0.3
  roundness: number; // 2 to 7 (Superellipse factor)
  cursorRadius: number; // 0 to 100
  shapeWidth?: number; // 20 to 800
  shapeHeight?: number; // 20 to 800
  showShape1?: boolean;
  
  // Colors
  tint: string; // Hex color
  tintAlpha: number; // 0 to 1
  saturation: number; // 0 to 2 (1 is normal)
  brightness: number; // 0 to 2 (1 is normal)
  
  // Shadow
  shadowExpand: number; // 2 to 100
  shadowFactor: number; // 0 to 100
  shadowOffset: { x: number, y: number };
  
  // Background
  backgroundImage?: string;
}

export const defaultSettings: ShapeMergeSettings = {
  refThickness: 20,
  refFactor: 1.4,
  refDispersion: 7,
  
  refFresnelRange: 30,
  refFresnelHardness: 20,
  refFresnelFactor: 20,
  
  glareRange: 30,
  glareHardness: 20,
  glareFactor: 90,
  glareAngle: -45,
  glareConvergence: 50,
  glareOppositeFactor: 80,
  
  blurRadius: 1,
  
  mergeRate: 0.05,
  roundness: 5.0,
  cursorRadius: 25.0,
  shapeWidth: 200,
  shapeHeight: 200,
  showShape1: true,
  
  tint: '#ffffff',
  tintAlpha: 0.0,
  saturation: 1.0,
  brightness: 1.0,
  
  shadowExpand: 25,
  shadowFactor: 15,
  shadowOffset: { x: 0, y: -10 },
  
  backgroundImage: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop'
};
