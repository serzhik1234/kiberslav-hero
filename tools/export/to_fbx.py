# Converts the blockout .glb (export.js) into .fbx (for Unity) and .blend (for the artist) with Blender.
# usage: python3 tools/export/to_fbx.py [in.glb]     (needs Blender's Python module: pip install bpy)
import os, sys
import bpy

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
src = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'export', 'kiberslav_blockout.glb'))
base = os.path.splitext(src)[0]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0   # no .blend1 backup next to the export
bpy.context.scene.render.fps = 30                       # before the import: clip seconds become frames at this rate
bpy.ops.import_scene.gltf(filepath=src, bone_heuristic='TEMPERANCE', guess_original_bind_pose=False)

arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
arm.name = 'Kiberslav_Rig'
# bones must not be 'connected': a connected bone cannot translate, and the FBX exporter would drop the
# hips' root motion (lunge, spin, jump) together with the guard step of the spear stance
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
for eb in arm.data.edit_bones:
    eb.use_connect = False
bpy.ops.object.mode_set(mode='OBJECT')
# the importer's bone display shape is not part of the model
for o in [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name.startswith('Icosphere')]:
    bpy.data.objects.remove(o)

# the .glb has one mesh per body part and material -> one object per part, all on the same rig
PARTS = ['Head', 'Torso', 'ArmLeft_Cyber', 'ArmRight', 'LegLeft', 'LegRight', 'Spear']
parts = {}
for part in PARTS:
    ms = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name.startswith('Part_' + part + '__')]
    if not ms:
        continue
    for o in bpy.context.scene.objects:
        o.select_set(o in ms)
    bpy.context.view_layer.objects.active = ms[0]
    if len(ms) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = ob.data.name = 'Kiberslav_' + part
    parts[part] = ob
mesh = parts['Torso']

# one action per clip, kept as NLA strips; the FBX exporter writes every action as its own take
actions = sorted(a.name for a in bpy.data.actions)
for a in bpy.data.actions:
    a.use_fake_user = True
scene = bpy.context.scene
if arm.animation_data and arm.animation_data.action is None and bpy.data.actions:
    arm.animation_data.action = bpy.data.actions.get('Idle') or bpy.data.actions[0]

bpy.ops.wm.save_as_mainfile(filepath=base + '.blend')
# export from the saved file: exporting in the import session drops the hips' translation keys
bpy.ops.wm.open_mainfile(filepath=base + '.blend')
arm = bpy.data.objects['Kiberslav_Rig']
bpy.ops.export_scene.fbx(
    filepath=base + '.fbx',
    use_selection=False,
    object_types={'ARMATURE', 'MESH'},
    apply_unit_scale=True, apply_scale_options='FBX_SCALE_NONE',   # FBX_SCALE_ALL / _UNITS drop the hips' translation keys (Blender 5.0)
    axis_forward='-Z', axis_up='Y',
    add_leaf_bones=False,
    bake_anim=True, bake_anim_use_all_actions=True, bake_anim_use_nla_strips=False,
    bake_anim_force_startend_keying=True, bake_anim_simplify_factor=0.0,
    path_mode='COPY', embed_textures=True,
)
print('actions:', actions)
print('bones:', len(arm.data.bones), 'parts:', {p: len(bpy.data.objects['Kiberslav_' + p].data.vertices) for p in PARTS if 'Kiberslav_' + p in bpy.data.objects})
print('written:', base + '.fbx', base + '.blend')

# ---- each part on its own: static mesh in the bind pose, origin at the joint it attaches to ----
ATTACH = {'Head': 'Neck', 'Torso': 'Hips', 'ArmLeft_Cyber': 'LeftShoulder', 'ArmRight': 'RightShoulder',
          'LegLeft': 'LeftUpLeg', 'LegRight': 'RightUpLeg', 'Spear': 'Spear'}
pdir = os.path.join(os.path.dirname(base), 'parts')
os.makedirs(pdir, exist_ok=True)
for part, joint in ATTACH.items():
    bpy.ops.wm.open_mainfile(filepath=base + '.blend')
    arm = bpy.data.objects['Kiberslav_Rig']
    ob = bpy.data.objects.get('Kiberslav_' + part)
    if ob is None:
        continue
    head = arm.matrix_world @ arm.data.bones[joint].head_local
    for o in list(bpy.data.objects):          # keep only this part
        if o is not ob:
            bpy.data.objects.remove(o)
    for md in list(ob.modifiers):              # no rig: the mesh stays in its bind (rest) shape
        ob.modifiers.remove(md)
    ob.vertex_groups.clear()
    ob.parent = None
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.context.scene.cursor.location = head
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    ob.location = (0, 0, 0)                    # the joint sits at the origin of the part file
    bpy.ops.outliner.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)   # drop other parts' materials
    name = os.path.join(pdir, part)
    bpy.ops.wm.save_as_mainfile(filepath=name + '.blend')
    bpy.ops.export_scene.fbx(filepath=name + '.fbx', use_selection=False, object_types={'MESH'},
        apply_unit_scale=True, apply_scale_options='FBX_SCALE_NONE', axis_forward='-Z', axis_up='Y',
        bake_anim=False, path_mode='COPY', embed_textures=True)
    bpy.ops.export_scene.gltf(filepath=name + '.glb', export_format='GLB', export_animations=False, export_skins=False)
    print('part', part, 'joint', joint, 'verts', len(ob.data.vertices), 'tris', sum(len(p.vertices) - 2 for p in ob.data.polygons))
