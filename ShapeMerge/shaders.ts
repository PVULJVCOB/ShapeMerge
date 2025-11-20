export const vertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const blurFragmentShader = `#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform vec2 u_direction; // (1, 0) for H, (0, 1) for V
uniform int u_radius;

out vec4 fragColor;

void main() {
  vec4 color = vec4(0.0);
  vec2 texelSize = 1.0 / u_resolution;
  float totalWeight = 0.0;
  
  // Simple Gaussian-ish kernel
  for (int i = -u_radius; i <= u_radius; i++) {
    float weight = exp(-float(i*i) / (2.0 * float(u_radius*u_radius) / 4.0));
    color += texture(u_texture, v_uv + vec2(float(i)) * u_direction * texelSize) * weight;
    totalWeight += weight;
  }
  
  fragColor = color / totalWeight;
}
`;

export const mainFragmentShader = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

// Textures
uniform sampler2D u_bgTexture;      // Original background
uniform sampler2D u_blurredBg;      // Blurred background

// Screen
uniform vec2 u_resolution;
uniform float u_dpr;
uniform vec2 u_mouse;

// Elements
uniform int u_elementCount;
uniform vec4 u_elements[50]; // x, y, width, height
uniform float u_cornerRadii[50];

// Settings
uniform float u_mergeRate;
uniform float u_roundness;
uniform float u_cursorRadius;

// Glass Settings
uniform float u_refThickness;
uniform float u_refFactor;
uniform float u_refDispersion;
uniform float u_refFresnelRange;
uniform float u_refFresnelFactor;
uniform float u_refFresnelHardness;
uniform float u_glareRange;
uniform float u_glareFactor;
uniform float u_glareHardness;
uniform float u_glareAngle;
uniform float u_glareConvergence;
uniform float u_glareOppositeFactor;
uniform float u_shadowExpand;
uniform float u_shadowFactor;
uniform vec2 u_shadowOffset;
uniform vec4 u_tint; // rgb, alpha
uniform float u_saturation;
uniform float u_brightness;

// --- SDF Functions ---

float smin(float a, float b, float k) {
  float k_safe = max(k, 0.001);
  float h = clamp(0.5 + 0.5 * (b - a) / k_safe, 0.0, 1.0);
  return mix(b, a, h) - k_safe * h * (1.0 - h);
}

float smax(float a, float b, float k) {
  return -smin(-a, -b, k);
}

float superellipseCornerSDF(vec2 p, float r, float n) {
  p = abs(p);
  float v = pow(pow(p.x, n) + pow(p.y, n), 1.0 / n);
  return v - r;
}

float roundedRectSDF(vec2 p, vec2 center, float width, float height, float cornerRadius, float n) {
  p -= center;
  float cr = cornerRadius;
  vec2 halfSize = vec2(width, height) * 0.5;
  vec2 d = abs(p) - halfSize;
  
  float dist;
  if (d.x > -cr && d.y > -cr) {
    vec2 cornerCenter = sign(p) * (halfSize - vec2(cr));
    vec2 cornerP = p - cornerCenter;
    dist = superellipseCornerSDF(cornerP, cr, n);
  } else {
    dist = min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
  }
  
  return dist;
}

// --- Main SDF Calculation ---

float map(vec2 p) {
  float finalSDF = 1e10;
  
  // Cursor
  float cursorRadius = u_cursorRadius * u_dpr;
  float cursorSDF = length(p - u_mouse) - cursorRadius;
  finalSDF = cursorSDF;

  // Elements
  for (int i = 0; i < u_elementCount && i < 50; i++) {
    vec4 elem = u_elements[i];
    // elem is in screen coords (pixels)
    // p is in screen coords (pixels)
    
    // Adjust for DPR if necessary (assuming u_elements are CSS pixels, p is physical pixels)
    vec2 center = elem.xy * u_dpr;
    float width = elem.z * u_dpr;
    float height = elem.w * u_dpr;
    float cornerRadius = u_cornerRadii[i] * u_dpr;
    
    // Optimization: Bounding Box Check
    // If pixel is too far from the element, skip expensive SDF
    // We add a safety margin (merge radius + some buffer)
    float safetyMargin = u_mergeRate * 1000.0 * u_dpr + 10.0;
    vec2 distToCenter = abs(p - center);
    if (distToCenter.x > (width * 0.5 + safetyMargin) || 
        distToCenter.y > (height * 0.5 + safetyMargin)) {
        // Too far, just use a simple box distance approximation or skip
        // If we skip, we need to make sure we don't break the smin chain.
        // smin(a, b, k) -> if b is large, result is a.
        // So we can just continue.
        continue;
    }

    float elemSDF = roundedRectSDF(
      p, 
      center, 
      width, 
      height, 
      cornerRadius, 
      u_roundness
    );
    
    // Scale mergeRate to be useful (0.05 -> 50px approx)
    finalSDF = smin(finalSDF, elemSDF, u_mergeRate * 1000.0 * u_dpr);
  }
  
  return finalSDF;
}

// --- Helpers ---

vec2 getNormal(vec2 p) {
  vec2 h = vec2(1.0, 0.0);
  return normalize(vec2(
    map(p + h.xy) - map(p - h.xy),
    map(p + h.yx) - map(p - h.yx)
  ));
}

// Chromatic Aberration Helper
vec4 getTextureDispersion(sampler2D tex, vec2 uv, vec2 offset, float dispersion) {
  vec4 pixel = vec4(1.0);
  float factor = dispersion;
  
  // Constants from Liquid Glass Studio
  const float N_R = 1.0 - 0.02;
  const float N_G = 1.0;
  const float N_B = 1.0 + 0.02;
  
  pixel.r = texture(tex, uv + offset * (1.0 - (N_R - 1.0) * factor)).r;
  pixel.g = texture(tex, uv + offset * (1.0 - (N_G - 1.0) * factor)).g;
  pixel.b = texture(tex, uv + offset * (1.0 - (N_B - 1.0) * factor)).b;
  
  return pixel;
}

vec3 adjustSaturation(vec3 color, float saturation) {
  const vec3 luma = vec3(0.2126, 0.7152, 0.0722);
  vec3 gray = vec3(dot(color, luma));
  return mix(gray, color, saturation);
}

void main() {
  vec2 p = gl_FragCoord.xy;
  // Flip Y for mouse/element coords matching
  p.y = u_resolution.y - p.y; 
  
  float merged = map(p);
  
  // --- Glass Effect Logic (Ported from Liquid Glass Studio) ---
  
  vec4 outColor = vec4(0.0);
  
  // 1. Background (Default)
  vec4 bgCol = texture(u_bgTexture, v_uv);
  
  if (merged < 0.0) {
    // Inside the shape
    
    // Calculate Normal
    vec2 normal = getNormal(p);
    
    // Normalized merged distance
    float nmerged = -1.0 * merged; // Positive inside
    
    // Refraction Edge Factor
    // Simulates the curvature of the glass edge
    float x_R_ratio = 1.0 - nmerged / (u_refThickness * u_dpr);
    float thetaI = asin(clamp(pow(x_R_ratio, 2.0), 0.0, 1.0));
    float thetaT = asin(clamp(1.0 / u_refFactor * sin(thetaI), -1.0, 1.0));
    float edgeFactor = -1.0 * tan(thetaT - thetaI);
    
    if (nmerged >= (u_refThickness * u_dpr)) {
      edgeFactor = 0.0; // Flat surface in the middle
    }
    
    // Sample Blurred Background with Distortion (Refraction)
    vec2 distortion = -normal * edgeFactor * 0.05 * u_dpr;
    // Aspect ratio correction for UV
    distortion.x *= (u_resolution.y / u_resolution.x);
    
    vec4 blurredPixel = getTextureDispersion(
      u_blurredBg,
      v_uv,
      distortion,
      u_refDispersion
    );
    
    // Fresnel (Reflection at edges)
    // Optimized pow(x, 2.0) -> x*x
    float fresnelBase = 1.0 + merged / 1500.0 * (500.0 / u_refFresnelRange) * (500.0 / u_refFresnelRange) + u_refFresnelHardness / 100.0;
    float fresnelFactor = clamp(
      pow(fresnelBase, 5.0),
      0.0, 1.0
    );
    
    // Mix Refraction + Fresnel
    outColor = mix(blurredPixel, vec4(1.0), fresnelFactor * u_refFresnelFactor / 100.0 * 0.7);
    
    // Saturation & Brightness
    outColor.rgb = adjustSaturation(outColor.rgb, u_saturation);
    outColor.rgb *= u_brightness;

    // Tint
    outColor = mix(outColor, u_tint, u_tint.a);
    
    // Glare (Specular Highlight)
    float glareAngleRad = radians(u_glareAngle);
    vec2 glareDir = vec2(cos(glareAngleRad), sin(glareAngleRad));
    float glareAngleFactor = clamp(dot(normal, glareDir), 0.0, 1.0);
    float glareOppositeAngleFactor = clamp(dot(normal, -glareDir), 0.0, 1.0);
    
    // Mask glare in the flat center to avoid "pyramid" artifacts
    float glareEdgeMask = smoothstep(u_refThickness * u_dpr, 0.0, nmerged);
    
    float glareBase = 1.0 + merged / 1500.0 * (500.0 / u_glareRange) * (500.0 / u_glareRange) + u_glareHardness / 100.0;
    float glareGeoFactor = clamp(
      pow(glareBase, 5.0 * u_glareConvergence / 100.0 * 10.0),
      0.0, 1.0
    );
    
    // Apply mask to glare
    float mainGlare = glareAngleFactor * glareGeoFactor * u_glareFactor / 100.0;
    float oppositeGlare = glareOppositeAngleFactor * glareGeoFactor * u_glareOppositeFactor / 100.0;
    
    outColor = mix(outColor, vec4(1.0), (mainGlare + oppositeGlare) * glareEdgeMask);
    
  } else {
    // Outside the shape
    outColor = bgCol;
    
    // Shadow Calculation
    // We need to sample the map function at an offset
    // Note: Calling map() again is expensive, but necessary for correct shadow shape
    vec2 shadowPos = p - u_shadowOffset * u_dpr;
    // Optimization: Only calculate shadow if we are close enough? 
    // For now, just calculate it.
    float shadowDist = map(shadowPos);
    
    if (shadowDist < 0.0) {
        // Inside the shadow casting shape
        // But we are outside the glass shape (else block)
        // Calculate shadow intensity based on distance to edge of shadow shape
        // Actually, if shadowDist < 0, we are "inside" the shadow.
        // But we want a soft shadow.
        
        // Simple hard shadow for now, smoothed by expand
        // shadowDist is negative inside.
        float shadowIntensity = smoothstep(0.0, -u_shadowExpand * u_dpr, shadowDist);
        outColor = mix(outColor, vec4(0.0, 0.0, 0.0, 1.0), shadowIntensity * u_shadowFactor / 100.0);
    } else {
        // Outside shadow shape, but maybe in the soft edge?
        // If u_shadowExpand defines the blurriness
        float shadowIntensity = 1.0 - smoothstep(-u_shadowExpand * u_dpr, 0.0, shadowDist);
        // This logic is a bit inverted. 
        // Let's try: 
        // We want shadow where map(p - offset) is < 0.
        // And we want it to fade out as map(p - offset) increases.
        
        // Correct logic:
        // float d = map(p - offset);
        // float s = 1.0 - smoothstep(-expand, expand, d); // This creates a soft border around 0
        // But we only want shadow "inside" the offset shape mostly.
        
        // Let's use the original repo logic idea:
        // float shadow = smoothstep(0.0, u_shadowExpand, merged); (This was from bg shader)
        
        // My implementation:
        float s = smoothstep(0.0, u_shadowExpand * u_dpr, -shadowDist); // Positive inside shadow
        outColor = mix(outColor, vec4(0.0, 0.0, 0.0, 1.0), s * u_shadowFactor / 100.0);
    }

    // Anti-aliasing / Smooth Edge
    float px = 1.0;
    float alpha = 1.0 - smoothstep(-px, px, merged);
    // We don't really need alpha blending here since we draw the background ourselves
    // But if we wanted to blend with the "outside", we are already doing it by if (merged < 0.0)
    // To make the edge smoother, we can mix near 0.0
    
    // Simple smooth mix at the edge
    outColor = mix(bgCol, outColor, alpha);
  }
  
  fragColor = outColor;
}
`;
