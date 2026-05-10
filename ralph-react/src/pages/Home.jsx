import { ConceptHome } from './HomeConcepts.jsx'
import { getConcept } from './homeConceptData'

export default function Home() {
	return <ConceptHome concept={getConcept('4')} showConceptNav={false} />
}
