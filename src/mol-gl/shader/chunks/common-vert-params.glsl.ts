export const common_vert_params = `
uniform mat4 uProjection, uModel, uView;
uniform vec3 uCameraPosition;

uniform int uObjectId;
uniform int uVertexCount;
uniform int uInstanceCount;
uniform int uGroupCount;
uniform vec4 uInvariantBoundingSphere;

uniform bool uDoubleSided;
uniform int uPickType;

#if dClipObjectCount != 0
    uniform int uClipObjectType[dClipObjectCount];
    uniform bool uClipObjectInvert[dClipObjectCount];
    uniform vec3 uClipObjectPosition[dClipObjectCount];
    uniform vec4 uClipObjectRotation[dClipObjectCount];
    uniform vec3 uClipObjectScale[dClipObjectCount];

    #if defined(dClipping)
        uniform vec2 uClippingTexDim;
        uniform sampler2D tClipping;
        #if __VERSION__ == 100
            varying float vClipping;
        #else
            flat out float vClipping;
        #endif
    #endif
#endif

#if defined(dRenderVariant_color) || defined(dRenderVariant_marking)
    uniform float uMarker;
    uniform vec2 uMarkerTexDim;
    uniform sampler2D tMarker;
    #if __VERSION__ == 100
        varying float vMarker;
    #else
        flat out float vMarker;
    #endif
#endif

varying vec3 vModelPosition;
varying vec3 vViewPosition;

#if defined(noNonInstancedActiveAttribs)
    #define VertexID gl_VertexID
#else
    attribute float aVertex;
    #define VertexID int(aVertex)
#endif
`;