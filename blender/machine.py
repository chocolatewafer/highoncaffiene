# Builds the espresso machine and exports public/models/machine.glb
# Run: blender -b -P blender/machine.py
import bpy, bmesh, math, os
from mathutils import Vector

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "models", "machine.glb")
bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene
TAU = math.tau

# ---------- materials (names are read by the site) ----------
def mat(name, rgb, metal=0.0, rough=0.5, emit=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = 4.0
    return m

M = {
    "steel":   mat("steel",   (0.62, 0.60, 0.58), 1.0, 0.26),
    "chrome":  mat("chrome",  (0.90, 0.88, 0.86), 1.0, 0.07),
    "dark":    mat("dark",    (0.025, 0.02, 0.018), 0.2, 0.45),
    "rubber":  mat("rubber",  (0.012, 0.010, 0.009), 0.0, 0.85),
    "walnut":  mat("walnut",  (0.16, 0.07, 0.035), 0.0, 0.42),
    "brass":   mat("brass",   (0.80, 0.52, 0.24), 1.0, 0.25),
    "ceramic": mat("ceramic", (0.86, 0.80, 0.72), 0.0, 0.18),
    "coffee":  mat("coffee",  (0.09, 0.04, 0.015), 0.0, 0.12),
    "crema":   mat("crema",   (0.55, 0.30, 0.12), 0.0, 0.35),
    "dial":    mat("dial",    (0.92, 0.87, 0.78), 0.0, 0.5),
    "glass":   mat("glass",   (1.0, 1.0, 1.0), 0.0, 0.02),
    "needle":  mat("needle",  (0.75, 0.18, 0.06), 0.0, 0.4),
    "led":     mat("led",     (1.0, 0.45, 0.1), 0.0, 0.3, emit=(1.0, 0.42, 0.08)),
    "inlay":   mat("inlay",   (0.86, 0.80, 0.70), 0.0, 0.35),
    "grate":   mat("grate",   (0.30, 0.29, 0.28), 1.0, 0.35),
}

# ---------- helpers ----------
def attach(ob, parent):
    """Parent without moving: the child keeps its world placement."""
    bpy.context.view_layer.update()
    ob.parent = parent
    ob.matrix_parent_inverse = parent.matrix_world.inverted()

def link(ob, parent=None):
    scn.collection.objects.link(ob)
    if parent:
        attach(ob, parent)
    return ob

def empty(name, loc=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    return link(e, parent)

def finish(ob, m, smooth=0.6):
    ob.data.materials.clear()
    ob.data.materials.append(M[m])
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    for md in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=md.name)
    if smooth:
        bpy.ops.object.shade_smooth_by_angle(angle=smooth)
    return ob

def from_bm(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return link(bpy.data.objects.new(name, me))

def rbox(name, size, loc, m, bevel=0.004, seg=4, parent=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    ob = from_bm(name, bm)
    ob.location = loc
    if bevel:
        md = ob.modifiers.new("b", "BEVEL")
        md.width = bevel
        md.segments = seg
        md.limit_method = "NONE"
    finish(ob, m)
    if parent:
        attach(ob, parent)
    return ob

def lathe(name, prof, loc, m, steps=72, rot=None, parent=None, smooth=1.2):
    """prof: list of (radius, z). Spun around local Z."""
    bm = bmesh.new()
    vs = [bm.verts.new((r, 0, z)) for r, z in prof]
    es = [bm.edges.new((vs[i], vs[i + 1])) for i in range(len(vs) - 1)]
    bmesh.ops.spin(bm, geom=vs + es, cent=(0, 0, 0), axis=(0, 0, 1), angle=TAU, steps=steps, use_merge=True)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = from_bm(name, bm)
    ob.location = loc
    if rot:
        ob.rotation_euler = rot
    finish(ob, m, smooth)
    if parent:
        attach(ob, parent)
    return ob

def disc(name, r, loc, m, rot=None, parent=None, seg=64):
    """Flat disc facing +Z with planar UVs (0..1) so a texture maps straight on."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    c = bm.verts.new((0, 0, 0))
    ring = [bm.verts.new((r * math.cos(a), r * math.sin(a), 0)) for a in [i / seg * TAU for i in range(seg)]]
    for i in range(seg):
        f = bm.faces.new((c, ring[i], ring[(i + 1) % seg]))
        for l in f.loops:
            l[uv].uv = (l.vert.co.x / r * 0.5 + 0.5, l.vert.co.y / r * 0.5 + 0.5)
    ob = from_bm(name, bm)
    ob.location = loc
    if rot:
        ob.rotation_euler = rot
    finish(ob, m, 0)
    if parent:
        attach(ob, parent)
    return ob

def tube(name, pts, r, m, parent=None, res=6):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r
    cu.bevel_resolution = res
    cu.use_fill_caps = True
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    cu.resolution_u = 16
    ob = link(bpy.data.objects.new(name, cu))
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.ops.object.convert(target="MESH")
    ob = bpy.context.view_layer.objects.active
    finish(ob, m, 1.0)
    if parent:
        attach(ob, parent)
    return ob

def cyl(name, r, h, loc, m, rot=None, parent=None, bevel=0.0015):
    # a lathe with small rounded edges
    b = min(bevel, r * 0.3, h * 0.3)
    prof = [(0, 0), (r - b, 0), (r - b * 0.3, b * 0.3), (r, b), (r, h - b), (r - b * 0.3, h - b * 0.3), (r - b, h), (0, h)]
    return lathe(name, prof, loc, m, rot=rot, parent=parent, smooth=0.9)

def text(name, body, size, loc, m, parent=None, rot=(math.pi / 2, 0, 0), extrude=0.0006, spacing=1.25):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.space_character = spacing
    ob = link(bpy.data.objects.new(name, cu))
    ob.location = loc
    ob.rotation_euler = rot
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.ops.object.convert(target="MESH")
    ob = bpy.context.view_layer.objects.active
    finish(ob, m, 0)
    if parent:
        attach(ob, parent)
    return ob

ROT_FRONT = (math.pi / 2, 0, 0)      # local +Z -> world -Y (facing the viewer)

# ---------- layout (metres, Z up, front = -Y) ----------
W, D, H0, H1 = 0.30, 0.40, 0.035, 0.405
FY = -D / 2                            # front face plane
root = empty("machine")

# feet
for sx in (-1, 1):
    for sy in (-1, 1):
        cyl("foot", 0.014, H0, (sx * 0.12, sy * 0.16, 0), "rubber", parent=root)

# body shell: steel box, front/back steel, walnut cheeks on the sides
body = rbox("body", (W, D, H1 - H0), (0, 0, (H0 + H1) / 2), "steel", bevel=0.014, seg=6, parent=root)
for sx in (-1, 1):
    rbox("cheek", (0.014, D - 0.05, H1 - H0 - 0.06), (sx * (W / 2 + 0.004), 0.004, (H0 + H1) / 2), "walnut", bevel=0.005, seg=4, parent=root)
# dark recessed band behind the group
rbox("panel", (W - 0.06, 0.004, 0.17), (0, FY - 0.001, 0.215), "dark", bevel=0.003, parent=root)

# top cup tray: grate + rail
rbox("tray_top", (W - 0.03, D - 0.05, 0.004), (0, 0.01, H1 + 0.002), "grate", bevel=0.0015, parent=root)
rail = [(-0.13, -0.17, H1 + 0.03), (0.13, -0.17, H1 + 0.03)]
tube("rail_front", [Vector(p) for p in rail], 0.005, "chrome", parent=root)
tube("rail_back", [Vector((-0.13, 0.18, H1 + 0.03)), Vector((0.13, 0.18, H1 + 0.03))], 0.005, "chrome", parent=root)
for sx in (-1, 1):
    tube("rail_side", [Vector((sx * 0.13, -0.17, H1 + 0.03)), Vector((sx * 0.13, 0.18, H1 + 0.03))], 0.005, "chrome", parent=root)
    for sy in (-0.17, 0.18):
        cyl("post", 0.0045, 0.03, (sx * 0.13, sy, H1), "chrome", parent=root)
# two cups resting upside down on top
for i, x in enumerate((-0.06, 0.05)):
    lathe("topcup", [(0, 0.055), (0.026, 0.055), (0.032, 0.05), (0.034, 0.03), (0.031, 0.008), (0.028, 0.0), (0.024, 0.0), (0.027, 0.008), (0.03, 0.03), (0.028, 0.05), (0, 0.052)],
          (x, 0.05 + i * 0.05, H1 + 0.004), "ceramic", parent=root)

# drip tray
TRAY_Z = H0 + 0.004
rbox("drip", (0.25, 0.155, 0.036), (0, FY - 0.07, TRAY_Z + 0.018), "steel", bevel=0.006, parent=root)
for i in range(15):
    x = -0.105 + i * 0.015
    rbox("bar", (0.007, 0.135, 0.003), (x, FY - 0.07, TRAY_Z + 0.037), "grate", bevel=0.001, seg=2, parent=root)
TRAY_TOP = TRAY_Z + 0.0385

# name inlaid along both walnut cheeks, readable from either side
CHEEK_X = W / 2 + 0.004 + 0.007
for sx in (1, -1):
    text("side_name", "SPARSH NIDHI", 0.034, (sx * (CHEEK_X + 0.0004), 0.004, 0.215), "inlay", parent=root,
         rot=(math.pi / 2, 0, sx * math.pi / 2), extrude=0.0009, spacing=1.08)
    rbox("side_rule", (0.0012, 0.29, 0.0016), (sx * (CHEEK_X + 0.0004), 0.004, 0.185), "brass", bevel=0.0003, seg=1, parent=root)

# badge
lathe("led", [(0, 0.004), (0.0035, 0.003), (0.004, 0)], (0.115, FY - 0.001, 0.375), "led", rot=ROT_FRONT, parent=root)

# gauges (left = boiler, right = brew pressure)
GZ = 0.335
for side, x in (("L", -0.085), ("R", 0.085)):
    g = empty("gauge_" + side, (x, FY, GZ), root)
    lathe("bezel", [(0.0, 0.0), (0.036, 0.0), (0.038, 0.004), (0.037, 0.010), (0.033, 0.013), (0.031, 0.011), (0.031, 0.006), (0, 0.006)],
          (x, FY, GZ), "chrome", rot=ROT_FRONT, parent=g)
    disc("dial_" + side, 0.0312, (x, FY - 0.0062, GZ), "dial", rot=ROT_FRONT, parent=g)
    nd = empty("needle_" + side, (x, FY - 0.008, GZ), g)
    rbox("needle", (0.0016, 0.0008, 0.024), (x, FY - 0.008, GZ + 0.009), "needle", bevel=0.0003, seg=1, parent=nd)
    cyl("hub", 0.0025, 0.002, (x, FY - 0.0072, GZ), "brass", rot=ROT_FRONT, parent=g)
    lathe("glass_" + side, [(0, 0.0115), (0.02, 0.0108), (0.031, 0.0098)], (x, FY, GZ), "glass", rot=ROT_FRONT, parent=g, smooth=1.5)

# E61-style group head
GX, GY = 0.0, FY - 0.075
cyl("group_neck", 0.026, 0.06, (0, FY + 0.005, 0.31), "chrome", rot=ROT_FRONT, parent=root)
G0, GS = 0.232, 0.85
group = empty("group", (GX, GY, G0), root)
lathe("group_body", [(r, z * GS) for r, z in [(0, 0.215), (0.012, 0.214), (0.022, 0.208), (0.03, 0.195), (0.033, 0.175), (0.031, 0.155), (0.036, 0.145),
                     (0.034, 0.128), (0.04, 0.12), (0.042, 0.1), (0.04, 0.085), (0.045, 0.075), (0.047, 0.05), (0.045, 0.03),
                     (0.047, 0.018), (0.047, 0.004), (0.04, 0.0), (0, 0.0)]], (GX, GY, G0), "chrome", parent=group)
GT = G0 + 0.215 * GS
# lever on top: pivots about X at the dome
lever = empty("lever", (GX, GY, GT), group)
tube("lever_arm", [Vector((GX, GY, GT)), Vector((GX, GY - 0.03, GT + 0.02)), Vector((GX, GY - 0.08, GT + 0.035))], 0.0045, "chrome", parent=lever)
lathe("lever_ball", [(0, -0.012), (0.009, -0.009), (0.012, 0), (0.009, 0.009), (0, 0.012)], (GX, GY - 0.085, GT + 0.037), "walnut", parent=lever)
cyl("lever_pivot", 0.008, 0.03, (GX - 0.015, GY, GT - 0.004), "chrome", rot=(0, math.pi / 2, 0), parent=group)

# portafilter (child of empty at the group axis so it can twist in/out)
PF_Z = G0
pf = empty("portafilter", (GX, GY, PF_Z), root)
lathe("pf_basket", [(0, -0.032), (0.03, -0.032), (0.037, -0.026), (0.04, -0.012), (0.042, 0.0), (0.046, 0.0), (0.046, 0.004), (0, 0.004)],
      (GX, GY, PF_Z - 0.004), "chrome", parent=pf)
for a in (0, math.pi):
    rbox("pf_ear", (0.012, 0.016, 0.004), (GX + math.cos(a + 0.6) * 0.05, GY + math.sin(a + 0.6) * 0.05, PF_Z - 0.002), "chrome", bevel=0.0015, seg=2, parent=pf)
lathe("pf_spout", [(0, -0.07), (0.009, -0.068), (0.012, -0.06), (0.014, -0.045), (0.02, -0.036), (0, -0.034)], (GX, GY, PF_Z), "chrome", parent=pf)
for sx in (-1, 1):
    lathe("pf_tip", [(0, -0.084), (0.004, -0.083), (0.004, -0.066), (0, -0.064)], (GX + sx * 0.009, GY, PF_Z), "chrome", parent=pf)
tube("pf_arm", [Vector((GX, GY - 0.035, PF_Z - 0.016)), Vector((GX, GY - 0.065, PF_Z - 0.02)), Vector((GX, GY - 0.085, PF_Z - 0.026))], 0.007, "chrome", parent=pf)
handle = lathe("pf_handle", [(0, 0), (0.011, 0.002), (0.013, 0.02), (0.015, 0.07), (0.0155, 0.1), (0.013, 0.112), (0, 0.115)],
               (GX, GY - 0.082, PF_Z - 0.026), "walnut", rot=(math.radians(97), 0, 0), parent=pf)
cyl("pf_ferrule", 0.0115, 0.01, (GX, GY - 0.078, PF_Z - 0.0255), "chrome", rot=(math.radians(97), 0, 0), parent=pf)

# steam (left) and hot water (right) valves + wands
for side, sx in (("steam", -1), ("water", 1)):
    kx = sx * 0.112
    cyl(side + "_valve", 0.012, 0.018, (kx, FY, 0.255), "chrome", rot=ROT_FRONT, parent=root)
    knob = empty(side + "_knob", (kx, FY - 0.018, 0.255), root)
    lathe(side + "_knobwood", [(0, 0), (0.019, 0.0), (0.021, 0.006), (0.021, 0.024), (0.018, 0.03), (0, 0.031)],
          (kx, FY - 0.018, 0.255), "walnut", rot=ROT_FRONT, parent=knob)
    cyl(side + "_cap", 0.008, 0.0015, (kx, FY - 0.049, 0.255), "brass", rot=ROT_FRONT, parent=knob)
    wand = empty(side + "_wand", (kx, FY - 0.01, 0.225), root)
    cyl(side + "_joint", 0.009, 0.022, (kx, FY - 0.005, 0.225), "chrome", rot=ROT_FRONT, parent=wand)
    if side == "steam":
        pts = [(kx, FY - 0.025, 0.225), (kx - 0.012, FY - 0.04, 0.215), (kx - 0.03, FY - 0.07, 0.15), (kx - 0.035, FY - 0.085, 0.085)]
        tube("steam_pipe", [Vector(p) for p in pts], 0.0042, "chrome", parent=wand)
        cyl("steam_tip", 0.005, 0.012, (kx - 0.035, FY - 0.0855, 0.074), "chrome", parent=wand)
        rbox("steam_grip", (0.016, 0.016, 0.04), (kx - 0.02, FY - 0.055, 0.19), "rubber", bevel=0.006, parent=wand)
    else:
        pts = [(kx, FY - 0.025, 0.225), (kx + 0.006, FY - 0.04, 0.2), (kx + 0.012, FY - 0.06, 0.15)]
        tube("water_pipe", [Vector(p) for p in pts], 0.004, "chrome", parent=wand)

# the cup on the drip tray
cup = empty("cup", (GX, GY, TRAY_TOP), root)
CS = 0.8
sq = lambda prof: [(r, z * CS) for r, z in prof]
lathe("saucer", [(0, 0.0), (0.042, 0.0), (0.058, 0.006), (0.064, 0.012), (0.061, 0.013), (0.045, 0.008), (0.022, 0.006), (0, 0.006)],
      (GX, GY, TRAY_TOP), "ceramic", parent=cup)
lathe("cup_body", sq([(0, 0.006), (0.02, 0.006), (0.027, 0.012), (0.032, 0.03), (0.034, 0.055), (0.0355, 0.062), (0.0335, 0.0625),
                   (0.031, 0.056), (0.0295, 0.03), (0.025, 0.016), (0, 0.014)]), (GX, GY, TRAY_TOP), "ceramic", parent=cup)
tube("cup_handle", [Vector((GX + 0.032, GY, TRAY_TOP + 0.04)), Vector((GX + 0.05, GY, TRAY_TOP + 0.039)),
                    Vector((GX + 0.052, GY, TRAY_TOP + 0.024)), Vector((GX + 0.031, GY, TRAY_TOP + 0.02))], 0.0042, "ceramic", parent=cup)
fill = empty("coffee_fill", (GX, GY, TRAY_TOP + 0.012), cup)
lathe("coffee", [(0, 0.0), (0.024, 0.0), (0.0298, 0.01), (0.0308, 0.03), (0, 0.03)], (GX, GY, TRAY_TOP + 0.012), "coffee", parent=fill)
disc("crema", 0.0306, (GX, GY, TRAY_TOP + 0.0422), "crema", parent=fill)

# ---------- export ----------
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=True, export_yup=True,
                          export_texcoords=True, export_normals=True, export_materials="EXPORT")
n = sum(1 for o in scn.objects if o.type == "MESH")
tris = sum(len(o.data.polygons) for o in scn.objects if o.type == "MESH")
print(f"EXPORTED {OUT} meshes={n} faces={tris}")
