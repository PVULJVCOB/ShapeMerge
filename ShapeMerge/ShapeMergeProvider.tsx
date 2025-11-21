import React, { createContext, useContext, useRef, useEffect, useCallback, useState } from 'react';
import { vertexShader, blurFragmentShader, mainFragmentShader } from './shaders';
import { ShapeMergeSettings, defaultSettings } from './settings';

interface MergeElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius: number;
}

interface ShapeMergeContextType {
  registerElement: (element: MergeElement) => void;
  unregisterElement: (id: string) => void;
  settings: ShapeMergeSettings;
  updateSettings: (newSettings: Partial<ShapeMergeSettings>) => void;
}

const ShapeMergeContext = createContext<ShapeMergeContextType | null>(null);

export const useShapeMergeContext = () => {
  const context = useContext(ShapeMergeContext);
  if (!context) throw new Error('useShapeMergeContext must be used within ShapeMergeProvider');
  return context;
};

export const ShapeMergeProvider: React.FC<{ children: React.ReactNode; initialSettings?: Partial<ShapeMergeSettings> }> = ({ 
  children,
  initialSettings 
}) => {
  const [settings, setSettings] = useState<ShapeMergeSettings>({ ...defaultSettings, ...initialSettings });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const elementsRef = useRef<Map<string, MergeElement>>(new Map());
  const mouseRef = useRef({ x: -1000, y: -1000 });
  
  // WebGL Resources
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programsRef = useRef<{
    blur: WebGLProgram;
    main: WebGLProgram;
  } | null>(null);
  const texturesRef = useRef<{
    bg: WebGLTexture;
    blurPass1: WebGLTexture;
    blurPass2: WebGLTexture;
  } | null>(null);
  const framebuffersRef = useRef<{
    pass1: WebGLFramebuffer;
    pass2: WebGLFramebuffer;
  } | null>(null);

  const updateSettings = (newSettings: Partial<ShapeMergeSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const registerElement = useCallback((element: MergeElement) => {
    elementsRef.current.set(element.id, element);
  }, []);

  const unregisterElement = useCallback((id: string) => {
    elementsRef.current.delete(id);
  }, []);

  // Helper to create shader
  const createShader = (gl: WebGL2RenderingContext, type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  };

  // Helper to create program
  const createProgram = (gl: WebGL2RenderingContext, vs: string, fs: string) => {
    const vertexShaderObj = createShader(gl, gl.VERTEX_SHADER, vs);
    const fragmentShaderObj = createShader(gl, gl.FRAGMENT_SHADER, fs);
    if (!vertexShaderObj || !fragmentShaderObj) return null;

    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShaderObj);
    gl.attachShader(program, fragmentShaderObj);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  };

  // Helper to create texture
  const createTexture = (gl: WebGL2RenderingContext) => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  };

  // Initialize WebGL
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', { alpha: false });
    if (!gl) return;
    glRef.current = gl;

    // Programs
    const blurProgram = createProgram(gl, vertexShader, blurFragmentShader);
    const mainProgram = createProgram(gl, vertexShader, mainFragmentShader);
    if (!blurProgram || !mainProgram) return;
    programsRef.current = { blur: blurProgram, main: mainProgram };

    // Geometry (Full screen quad)
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const posLoc = 0; // layout(location = 0)
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // Textures & FBOs
    const bgTex = createTexture(gl);
    const blurPass1Tex = createTexture(gl);
    const blurPass2Tex = createTexture(gl);
    texturesRef.current = { bg: bgTex!, blurPass1: blurPass1Tex!, blurPass2: blurPass2Tex! };

    const fbo1 = gl.createFramebuffer();
    const fbo2 = gl.createFramebuffer();
    framebuffersRef.current = { pass1: fbo1!, pass2: fbo2! };

    // Load Background Image
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = settings.backgroundImage || '';
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, bgTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    };

    // Resize Handler
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap DPR at 2 for performance
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      
      // Resize textures (Full resolution)
      [blurPass1Tex, blurPass2Tex].forEach(tex => {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      });
    };
    window.addEventListener('resize', resize);
    resize();

    // Mouse Handler
    const handleMouseMove = (e: MouseEvent) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // Top-Left origin to match shader's flipped Y
      mouseRef.current = { 
        x: e.clientX * dpr, 
        y: e.clientY * dpr 
      };
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Render Loop
    let rafId: number;
    const render = () => {
      if (!gl || !programsRef.current || !texturesRef.current || !framebuffersRef.current) return;
      
      const { blur, main } = programsRef.current;
      const { bg, blurPass1, blurPass2 } = texturesRef.current;
      const { pass1, pass2 } = framebuffersRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      // --- PASS 1: Horizontal Blur ---
      gl.bindFramebuffer(gl.FRAMEBUFFER, pass1);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, blurPass1, 0);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(blur);
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, bg);
      gl.uniform1i(gl.getUniformLocation(blur, 'u_texture'), 0);
      gl.uniform2f(gl.getUniformLocation(blur, 'u_resolution'), canvas.width, canvas.height);
      gl.uniform2f(gl.getUniformLocation(blur, 'u_direction'), 1.0, 0.0); // Horizontal
      gl.uniform1i(gl.getUniformLocation(blur, 'u_radius'), Math.max(1, Math.floor(settings.blurRadius)));
      
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // --- PASS 2: Vertical Blur ---
      gl.bindFramebuffer(gl.FRAMEBUFFER, pass2);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, blurPass2, 0);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(blur);
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, blurPass1); // Input is result of Pass 1
      gl.uniform2f(gl.getUniformLocation(blur, 'u_direction'), 0.0, 1.0); // Vertical
      gl.uniform2f(gl.getUniformLocation(blur, 'u_resolution'), canvas.width, canvas.height);
      
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // --- PASS 3: Main Render to Screen ---
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(main);

      // Bind Textures
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, bg);
      gl.uniform1i(gl.getUniformLocation(main, 'u_bgTexture'), 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, blurPass2); // Result of Pass 2 (Fully blurred)
      gl.uniform1i(gl.getUniformLocation(main, 'u_blurredBg'), 1);

      // Uniforms
      gl.uniform2f(gl.getUniformLocation(main, 'u_resolution'), canvas.width, canvas.height);
      gl.uniform1f(gl.getUniformLocation(main, 'u_dpr'), dpr);
      gl.uniform2f(gl.getUniformLocation(main, 'u_mouse'), mouseRef.current.x, mouseRef.current.y);

      // Settings Uniforms
      gl.uniform1f(gl.getUniformLocation(main, 'u_mergeRate'), settings.mergeRate);
      gl.uniform1f(gl.getUniformLocation(main, 'u_roundness'), settings.roundness);
      gl.uniform1f(gl.getUniformLocation(main, 'u_cursorRadius'), settings.cursorRadius);
      gl.uniform1f(gl.getUniformLocation(main, 'u_refThickness'), settings.refThickness);
      gl.uniform1f(gl.getUniformLocation(main, 'u_refFactor'), settings.refFactor);
      gl.uniform1f(gl.getUniformLocation(main, 'u_refDispersion'), settings.refDispersion);
      gl.uniform1f(gl.getUniformLocation(main, 'u_refFresnelRange'), settings.refFresnelRange);
      gl.uniform1f(gl.getUniformLocation(main, 'u_refFresnelFactor'), settings.refFresnelFactor);
      gl.uniform1f(gl.getUniformLocation(main, 'u_refFresnelHardness'), settings.refFresnelHardness);
      gl.uniform1f(gl.getUniformLocation(main, 'u_glareRange'), settings.glareRange);
      gl.uniform1f(gl.getUniformLocation(main, 'u_glareFactor'), settings.glareFactor);
      gl.uniform1f(gl.getUniformLocation(main, 'u_glareHardness'), settings.glareHardness);
      gl.uniform1f(gl.getUniformLocation(main, 'u_glareAngle'), settings.glareAngle);
      gl.uniform1f(gl.getUniformLocation(main, 'u_glareConvergence'), settings.glareConvergence);
      gl.uniform1f(gl.getUniformLocation(main, 'u_glareOppositeFactor'), settings.glareOppositeFactor);
      gl.uniform1f(gl.getUniformLocation(main, 'u_shadowExpand'), settings.shadowExpand);
      gl.uniform1f(gl.getUniformLocation(main, 'u_shadowFactor'), settings.shadowFactor);
      gl.uniform2f(gl.getUniformLocation(main, 'u_shadowOffset'), settings.shadowOffset.x, settings.shadowOffset.y);
      
      // Tint Color
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
          parseInt(result[1], 16) / 255,
          parseInt(result[2], 16) / 255,
          parseInt(result[3], 16) / 255
        ] : [1, 1, 1];
      };
      const rgb = hexToRgb(settings.tint);
      gl.uniform4f(gl.getUniformLocation(main, 'u_tint'), rgb[0], rgb[1], rgb[2], settings.tintAlpha);
      gl.uniform1f(gl.getUniformLocation(main, 'u_saturation'), settings.saturation);
      gl.uniform1f(gl.getUniformLocation(main, 'u_brightness'), settings.brightness);

      // Elements
      let elements = Array.from(elementsRef.current.values());
      
      if (settings.showShape1 === false) {
        elements = [];
      }

      gl.uniform1i(gl.getUniformLocation(main, 'u_elementCount'), elements.length);
      
      const elementData = new Float32Array(50 * 4);
      const cornerRadii = new Float32Array(50);
      
      elements.forEach((el, i) => {
        if (i >= 50) return;
        // Top-Left origin
        elementData[i * 4 + 0] = el.x + el.width / 2; // Center X
        elementData[i * 4 + 1] = el.y + el.height / 2; // Center Y
        elementData[i * 4 + 2] = el.width;
        elementData[i * 4 + 3] = el.height;
        cornerRadii[i] = el.cornerRadius;
      });
      
      gl.uniform4fv(gl.getUniformLocation(main, 'u_elements'), elementData);
      gl.uniform1fv(gl.getUniformLocation(main, 'u_cornerRadii'), cornerRadii);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      
      rafId = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [settings]); // Re-init if settings change (e.g. background image)

  return (
    <ShapeMergeContext.Provider value={{ registerElement, unregisterElement, settings, updateSettings }}>
      <canvas 
        ref={canvasRef} 
        style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} 
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </ShapeMergeContext.Provider>
  );
};
