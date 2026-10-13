// Page id → view component, loaded on first visit. Record<PageId, …> makes a page without a view a type error.
import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { PageId } from './pages'

function view<M>(load: () => Promise<M>, name: keyof M): LazyExoticComponent<ComponentType> {
  return lazy(() => load().then((m) => ({ default: m[name] as ComponentType })))
}

export const PAGE_COMPONENTS: Record<PageId, LazyExoticComponent<ComponentType>> = {
  timeline: view(() => import('./views/Timeline'), 'Timeline'),
  people: view(() => import('./views/People'), 'People'),
  network: view(() => import('./views/Network'), 'Network'),
  fates: view(() => import('./views/Fates'), 'Fates'),
  orgs: view(() => import('./views/Orgs'), 'Orgs'),
  river: view(() => import('./views/River'), 'RiverPeople'),
  control: view(() => import('./views/River'), 'RiverOrgs'),
  factions: view(() => import('./views/Factions'), 'Factions'),
  map: view(() => import('./views/Map'), 'MapView'),
  lineage: view(() => import('./views/Ideas'), 'LineagePage'),
  spectrum: view(() => import('./views/Ideas'), 'SpectrumPage'),
  'ism-stream': view(() => import('./views/Ideas'), 'StreamPage'),
  press: view(() => import('./views/Ideas'), 'PressPage'),
  concepts: view(() => import('./views/Ideas'), 'ConceptsPage'),
  survival: view(() => import('./views/insights/Survival'), 'Survival'),
  overlap: view(() => import('./views/insights/Overlap'), 'Overlap'),
  parallel: view(() => import('./views/insights/Parallel'), 'Parallel'),
  moments: view(() => import('./views/insights/Moments'), 'Moments'),
  docs: view(() => import('./views/Docs'), 'Docs'),
  figures: view(() => import('./views/Figures'), 'Figures'),
  series: view(() => import('./views/Series'), 'SeriesView'),
  narratives: view(() => import('./views/Narratives'), 'Narratives'),
  research: view(() => import('./views/Research'), 'Research'),
}
