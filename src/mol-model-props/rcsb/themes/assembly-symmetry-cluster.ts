/**
 * Copyright (c) 2018-2020 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import { ThemeDataContext } from '../../../mol-theme/theme';
import { ColorTheme, LocationColor } from '../../../mol-theme/color';
import { ParamDefinition as PD } from '../../../mol-util/param-definition'
import { AssemblySymmetryProvider, AssemblySymmetry, getSymmetrySelectParam } from '../assembly-symmetry';
import { Color } from '../../../mol-util/color';
import { Unit, StructureElement, StructureProperties } from '../../../mol-model/structure';
import { Location } from '../../../mol-model/location';
import { ScaleLegend, TableLegend } from '../../../mol-util/legend';
import { getPalette, getPaletteParams } from '../../../mol-util/color/palette';
import { CustomProperty } from '../../common/custom-property';

const DefaultColor = Color(0xCCCCCC)

function getAsymId(unit: Unit): StructureElement.Property<string> {
    switch (unit.kind) {
        case Unit.Kind.Atomic:
            return StructureProperties.chain.label_asym_id
        case Unit.Kind.Spheres:
        case Unit.Kind.Gaussians:
            return StructureProperties.coarse.asym_id
    }
}

function clusterMemberKey(asymId: string, operList: string[]) {
    return `${asymId}-${operList.join('|')}`
}

export const AssemblySymmetryClusterColorThemeParams = {
    ...getPaletteParams({ scaleList: 'red-yellow-blue' }),
    symmetryIndex: getSymmetrySelectParam(),
}
export type AssemblySymmetryClusterColorThemeParams = typeof AssemblySymmetryClusterColorThemeParams
export function getAssemblySymmetryClusterColorThemeParams(ctx: ThemeDataContext) {
    const params = PD.clone(AssemblySymmetryClusterColorThemeParams)
    params.symmetryIndex = getSymmetrySelectParam(ctx.structure)
    return params
}

export function AssemblySymmetryClusterColorTheme(ctx: ThemeDataContext, props: PD.Values<AssemblySymmetryClusterColorThemeParams>): ColorTheme<AssemblySymmetryClusterColorThemeParams> {
    let color: LocationColor = () => DefaultColor
    let legend: ScaleLegend | TableLegend | undefined

    const { symmetryIndex } = props
    const assemblySymmetry = ctx.structure && AssemblySymmetryProvider.get(ctx.structure)
    const contextHash = assemblySymmetry?.version

    const clusters = assemblySymmetry?.value?.[symmetryIndex]?.clusters

    if (clusters?.length && ctx.structure) {
        const clusterByMember = new Map<string, number>()
        for (let i = 0, il = clusters.length; i < il; ++i) {
            const { members } = clusters[i]!
            for (let j = 0, jl = members.length; j < jl; ++j) {
                const asymId = members[j]!.asym_id
                const operList = [...members[j]!.pdbx_struct_oper_list_ids || []] as string[]
                clusterByMember.set(clusterMemberKey(asymId, operList), i)
                if (operList.length === 0) {
                    operList.push('1') // TODO hack assuming '1' is the id of the identity operator
                    clusterByMember.set(clusterMemberKey(asymId, operList), i)
                }
            }
        }
        const palette = getPalette(clusters.length, props)
        legend = palette.legend

        color = (location: Location): Color => {
            if (StructureElement.Location.is(location)) {
                const { assembly } = location.unit.conformation.operator
                const asymId = getAsymId(location.unit)(location)
                const cluster = clusterByMember.get(clusterMemberKey(asymId, assembly.operList))
                return cluster !== undefined ? palette.color(cluster) : DefaultColor
            }
            return DefaultColor
        }
    }

    return {
        factory: AssemblySymmetryClusterColorTheme,
        granularity: 'instance',
        color,
        props,
        contextHash,
        description: 'Assigns chain colors according to assembly symmetry cluster membership.',
        legend
    }
}

export const AssemblySymmetryClusterColorThemeProvider: ColorTheme.Provider<AssemblySymmetryClusterColorThemeParams> = {
    label: 'RCSB Assembly Symmetry Cluster',
    factory: AssemblySymmetryClusterColorTheme,
    getParams: getAssemblySymmetryClusterColorThemeParams,
    defaultValues: PD.getDefaultValues(AssemblySymmetryClusterColorThemeParams),
    isApplicable: (ctx: ThemeDataContext) => AssemblySymmetry.isApplicable(ctx.structure),
    ensureCustomProperties: (ctx: CustomProperty.Context, data: ThemeDataContext) => {
        return data.structure ? AssemblySymmetryProvider.attach(ctx, data.structure) : Promise.resolve()
    }
}