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

# one mesh per material in the .glb -> one object with all materials
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in bpy.context.scene.objects:
    o.select_set(o in meshes)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.join()
mesh = bpy.context.view_layer.objects.active
mesh.name = 'Kiberslav'

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
arm = bpy.data.objects['Kiberslav_Rig']; mesh = bpy.data.objects['Kiberslav']
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
print('bones:', len(arm.data.bones), 'verts:', len(mesh.data.vertices), 'materials:', len(mesh.data.materials))
print('written:', base + '.fbx', base + '.blend')
