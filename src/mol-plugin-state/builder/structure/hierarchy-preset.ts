/**
 * Copyright (c) 2020 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import { PresetProvider } from '../preset-provider';
import { PluginStateObject } from '../../objects';
import { ParamDefinition as PD } from '../../../mol-util/param-definition';
import { StateObjectRef, StateTransformer } from '../../../mol-state';
import { StateTransforms } from '../../transforms';
import { RootStructureDefinition } from '../../helpers/root-structure';
import { PresetStructureRepresentations } from './representation-preset';
import { PluginContext } from '../../../mol-plugin/context';
import { Vec3 } from '../../../mol-math/linear-algebra';
import { Model } from '../../../mol-model/structure';

export interface TrajectoryHierarchyPresetProvider<P = any, S = {}> extends PresetProvider<PluginStateObject.Molecule.Trajectory, P, S> { }
export function TrajectoryHierarchyPresetProvider<P, S>(preset: TrajectoryHierarchyPresetProvider<P, S>) { return preset; }
export namespace TrajectoryHierarchyPresetProvider {
    export type Params<P extends TrajectoryHierarchyPresetProvider> = P extends TrajectoryHierarchyPresetProvider<infer T> ? T : never;
    export type State<P extends TrajectoryHierarchyPresetProvider> = P extends TrajectoryHierarchyPresetProvider<infer _, infer S> ? S : never;

    export const CommonParams = (a: PluginStateObject.Molecule.Trajectory | undefined, plugin: PluginContext) => ({
        modelProperties: PD.Optional(PD.Group(StateTransformer.getParamDefinition(StateTransforms.Model.CustomModelProperties, void 0, plugin))),
        structureProperties: PD.Optional(PD.Group(StateTransformer.getParamDefinition(StateTransforms.Model.CustomStructureProperties, void 0, plugin))),
        representationPreset: PD.Optional(PD.Text<keyof PresetStructureRepresentations>('auto' as const)),
    })
}

const CommonParams = TrajectoryHierarchyPresetProvider.CommonParams

const FirstModelParams = (a: PluginStateObject.Molecule.Trajectory | undefined, plugin: PluginContext) =>  ({
    model: PD.Optional(PD.Group(StateTransformer.getParamDefinition(StateTransforms.Model.ModelFromTrajectory, a, plugin))),
    showUnitcell: PD.Optional(PD.Boolean(false)),
    structure: PD.Optional(RootStructureDefinition.getParams(void 0, 'assembly').type),
    ...CommonParams(a, plugin)
});

const firstModel = TrajectoryHierarchyPresetProvider({
    id: 'preset-trajectory-first-model',
    display: { name: 'First Model', group: 'Preset' },
    isApplicable: o => {
        return true
    },
    params: FirstModelParams,
    async apply(trajectory, params, plugin) {
        const builder = plugin.builders.structure;

        const model = await builder.createModel(trajectory, params.model);
        const modelProperties = await builder.insertModelProperties(model, params.modelProperties);

        const structure = await builder.createStructure(modelProperties || model, params.structure);
        const structureProperties = await builder.insertStructureProperties(structure, params.structureProperties);

        const unitcell = params.showUnitcell === void 0 || !!params.showUnitcell ? await builder.tryCreateUnitcell(modelProperties, undefined, { isHidden: true }) : void 0;
        const representation =  await plugin.builders.structure.representation.applyPreset(structureProperties, params.representationPreset || 'auto');

        return {
            model,
            modelProperties,
            unitcell,
            structure,
            structureProperties,
            representation
        };
    }
});

const allModels = TrajectoryHierarchyPresetProvider({
    id: 'preset-trajectory-all-models',
    display: { name: 'All Models', group: 'Preset' },
    isApplicable: o => {
        return o.data.length > 1
    },
    params: CommonParams,
    async apply(trajectory, params, plugin) {
        const tr = StateObjectRef.resolveAndCheck(plugin.state.data, trajectory)?.obj?.data;
        if (!tr) return { };

        const builder = plugin.builders.structure;

        const models = [], structures = [];

        for (let i = 0; i < tr.length; i++) {
            const model = await builder.createModel(trajectory, { modelIndex: i }, { isCollapsed: true });
            const modelProperties = await builder.insertModelProperties(model, params.modelProperties);
            const structure = await builder.createStructure(modelProperties || model, { name: 'deposited', params: {} });
            const structureProperties = await builder.insertStructureProperties(structure, params.structureProperties);

            models.push(model);
            structures.push(structure);
            await builder.representation.applyPreset(structureProperties, params.representationPreset || 'auto', { globalThemeName: 'model-index', quality: 'medium' });
        }

        return { models, structures };
    }
});

const CrystalSymmetryParams = (a: PluginStateObject.Molecule.Trajectory | undefined, plugin: PluginContext) => ({
    model: PD.Optional(PD.Group(StateTransformer.getParamDefinition(StateTransforms.Model.ModelFromTrajectory, a, plugin))),
    ...CommonParams(a, plugin)
});

async function applyCrystalSymmetry(ijk: { ijkMin: Vec3, ijkMax: Vec3 }, trajectory: StateObjectRef<PluginStateObject.Molecule.Trajectory>, params: PD.ValuesFor<ReturnType<typeof CrystalSymmetryParams>>, plugin: PluginContext) {
    const builder = plugin.builders.structure;

    const model = await builder.createModel(trajectory, params.model);
    const modelProperties = await builder.insertModelProperties(model, params.modelProperties);

    const structure = await builder.createStructure(modelProperties || model, {
        name: 'symmetry',
        params: ijk
    });
    const structureProperties = await builder.insertStructureProperties(structure, params.structureProperties);

    const unitcell = await builder.tryCreateUnitcell(modelProperties, undefined, { isHidden: false });
    const representation =  await plugin.builders.structure.representation.applyPreset(structureProperties, params.representationPreset || 'auto');

    return {
        model,
        modelProperties,
        unitcell,
        structure,
        structureProperties,
        representation
    };
}

const unitcell = TrajectoryHierarchyPresetProvider({
    id: 'preset-trajectory-unitcell',
    display: { name: 'Unitcell', group: 'Preset' },
    isApplicable: o => {
        return Model.hasCrystalSymmetry(o.data[0])
    },
    params: CrystalSymmetryParams,
    async apply(trajectory, params, plugin) {
        return await applyCrystalSymmetry({ ijkMin: Vec3.create(0, 0, 0), ijkMax: Vec3.create(0, 0, 0) }, trajectory, params, plugin);
    }
});

const supercell = TrajectoryHierarchyPresetProvider({
    id: 'preset-trajectory-supercell',
    display: { name: 'Supercell', group: 'Preset' },
    isApplicable: o => {
        return Model.hasCrystalSymmetry(o.data[0])
    },
    params: CrystalSymmetryParams,
    async apply(trajectory, params, plugin) {
        return await applyCrystalSymmetry({ ijkMin: Vec3.create(-1, -1, -1), ijkMax: Vec3.create(1, 1, 1) }, trajectory, params, plugin);
    }
});

export const PresetTrajectoryHierarchy = {
    'first-model': firstModel,
    'all-models': allModels,
    unitcell,
    supercell,
};
export type PresetTrajectoryHierarchy = typeof PresetTrajectoryHierarchy;