// Entity type → drawer card. Record<EntityType, …> makes a new entity type without a card a type error.
import type { ComponentType } from 'react'
import type { EntityType } from '../../data/atlas'
import { ClaimCard } from './ClaimCard'
import { ConceptCard } from './ConceptCard'
import { DocCard } from './DocCard'
import { EventCard } from './EventCard'
import { FactionCard } from './FactionCard'
import { IsmCard } from './IsmCard'
import { OrgCard } from './OrgCard'
import { PersonCard } from './PersonCard'

// sub is the selection's narrowing (a source within a concept, a location within a source)
export const CARDS: Record<EntityType, ComponentType<{ id: string; sub?: string }>> = {
  person: PersonCard,
  event: EventCard,
  concept: ConceptCard,
  faction: FactionCard,
  doc: DocCard,
  org: OrgCard,
  ism: IsmCard,
  claim: ClaimCard,
}
