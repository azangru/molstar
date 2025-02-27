export const assign_material_color = `
#if defined(dRenderVariant_color) || defined(dRenderVariant_marking)
    float marker = uMarker;
    if (uMarker == -1.0) {
        marker = floor(vMarker * 255.0 + 0.5); // rounding required to work on some cards on win
    }
#endif

#if defined(dRenderVariant_color)
    #if defined(dUsePalette)
        vec4 material = vec4(texture2D(tPalette, vec2(vPaletteV, 0.5)).rgb, uAlpha);
    #elif defined(dColorType_uniform)
        vec4 material = vec4(uColor, uAlpha);
    #elif defined(dColorType_varying)
        vec4 material = vec4(vColor.rgb, uAlpha);
    #endif

    // mix material with overpaint
    #if defined(dOverpaint)
        material.rgb = mix(material.rgb, vOverpaint.rgb, vOverpaint.a);
    #endif

    float metalness = uMetalness;
    float roughness = uRoughness;
    float bumpiness = uBumpiness;
    #ifdef dSubstance
        metalness = mix(metalness, vSubstance.r, vSubstance.a);
        roughness = mix(roughness, vSubstance.g, vSubstance.a);
        bumpiness = mix(bumpiness, vSubstance.b, vSubstance.a);
    #endif
#elif defined(dRenderVariant_depth)
    if (fragmentDepth > getDepth(gl_FragCoord.xy / uDrawingBufferSize)) {
        discard;
    }

    #ifndef dXrayShaded
        #if defined(dTransparency)
            float dta = 1.0 - vTransparency;
            if (vTransparency < 0.2) dta = 1.0; // hard cutoff looks better

            if (uRenderMask == MaskTransparent && uAlpha * dta == 1.0) {
                discard;
            } else if (uRenderMask == MaskOpaque && uAlpha * dta < 1.0) {
                discard;
            }
        #else
            if (uRenderMask == MaskTransparent && uAlpha == 1.0) {
                discard;
            } else if (uRenderMask == MaskOpaque && uAlpha < 1.0) {
                discard;
            }
        #endif
    #else
        if (uRenderMask == MaskOpaque) {
            discard;
        }
    #endif

    vec4 material = packDepthToRGBA(fragmentDepth);
#elif defined(dRenderVariant_marking)
    vec4 material;
    if(uMarkingType == 1) {
        if (marker > 0.0)
            discard;
        #ifdef enabledFragDepth
            material = packDepthToRGBA(gl_FragDepthEXT);
        #else
            material = packDepthToRGBA(gl_FragCoord.z);
        #endif
    } else {
        if (marker == 0.0)
            discard;
        float depthTest = 1.0;
        if (uMarkingDepthTest) {
            depthTest = (fragmentDepth >= getDepthPacked(gl_FragCoord.xy / uDrawingBufferSize)) ? 1.0 : 0.0;
        }
        bool isHighlight = intMod(marker, 2.0) > 0.1;
        float viewZ = depthToViewZ(uIsOrtho, fragmentDepth, uNear, uFar);
        float fogFactor = smoothstep(uFogNear, uFogFar, abs(viewZ));
        if (fogFactor == 1.0)
            discard;
        material = vec4(0.0, depthTest, isHighlight ? 1.0 : 0.0, 1.0 - fogFactor);
    }
#endif

// apply per-group transparency
#if defined(dTransparency) && (defined(dRenderVariant_pick) || defined(dRenderVariant_color))
    float ta = 1.0 - vTransparency;
    if (vTransparency < 0.2) ta = 1.0; // hard cutoff looks better

    #if defined(dRenderVariant_pick)
        if (ta < uPickingAlphaThreshold)
            discard; // ignore so the element below can be picked
    #elif defined(dRenderVariant_color)
        material.a *= ta;

        #if defined(dRenderVariant_colorBlended)
            #if defined(dTransparentBackfaces_off)
                if ((uRenderMask == MaskOpaque && material.a < 1.0) ||
                    (uRenderMask == MaskTransparent && material.a == 1.0) ||
                    (interior && material.a < 1.0)
                ) {
                    discard;
                }
            #elif defined(dTransparentBackfaces_on)
                if ((uRenderMask == MaskOpaque && material.a < 1.0) ||
                    (uRenderMask == MaskTransparent && material.a == 1.0)
                ) {
                    discard;
                }
            #elif defined(dTransparentBackfaces_opaque)
                if (interior) {
                    material.a = 1.0;
                } else if (
                    (uRenderMask == MaskOpaque && material.a < 1.0) ||
                    (uRenderMask == MaskTransparent && material.a == 1.0)
                ) {
                    discard;
                }
            #endif
        #endif
    #endif
#endif
`;