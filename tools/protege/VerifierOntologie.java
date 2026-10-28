import java.io.File;
import java.util.stream.Collectors;
import org.semanticweb.HermiT.ReasonerFactory;
import org.semanticweb.owlapi.apibinding.OWLManager;
import org.semanticweb.owlapi.model.*;
import org.semanticweb.owlapi.reasoner.*;

/**
 * Charge nexora.owl avec l'OWL API (le moteur de Protégé) puis lance le raisonneur HermiT (plugin de Protégé) :
 * statistiques, cohérence, classes insatisfiables et quelques inférences.
 * Usage : java -cp "<Protege>/bundles/*;<Protege>/plugins/org.semanticweb.hermit-*.jar" VerifierOntologie.java <fichier.owl>
 */
public class VerifierOntologie {
    public static void main(String[] args) throws Exception {
        OWLOntologyManager manager = OWLManager.createOWLOntologyManager();
        OWLOntology onto = manager.loadOntologyFromOntologyDocument(new File(args[0]));
        System.out.println("Ontologie        : " + String.valueOf(onto.getOntologyID().getOntologyIRI().orNull()));
        System.out.println("Format           : " + manager.getOntologyFormat(onto));
        System.out.println("Axiomes          : " + onto.getAxiomCount());
        System.out.println("Classes          : " + onto.getClassesInSignature().size());
        System.out.println("Propriétés objet : " + onto.getObjectPropertiesInSignature().size());
        System.out.println("Propriétés data  : " + onto.getDataPropertiesInSignature().size());
        System.out.println("Individus        : " + onto.getIndividualsInSignature().size());

        OWLReasoner reasoner = new ReasonerFactory().createReasoner(onto);
        reasoner.precomputeInferences(InferenceType.CLASS_HIERARCHY, InferenceType.CLASS_ASSERTIONS);
        boolean consistent = reasoner.isConsistent();
        System.out.println("HermiT cohérence : " + (consistent ? "COHÉRENTE" : "INCOHÉRENTE"));
        if (!consistent) System.exit(2);
        var unsat = reasoner.getUnsatisfiableClasses().getEntitiesMinusBottom();
        System.out.println("Classes insatisfiables : " + (unsat.isEmpty() ? "aucune" : unsat));

        OWLDataFactory df = manager.getOWLDataFactory();
        String ns = "http://www.nexora.org/ontologie/pharma#";
        for (String cls : new String[]{"Personne", "Condition"}) {
            OWLClass c = df.getOWLClass(IRI.create(ns + cls));
            String inst = reasoner.getInstances(c, false).getFlattened().stream()
                .map(i -> i.getIRI().getShortForm()).sorted().collect(Collectors.joining(", "));
            System.out.println("Inféré — instances de " + cls + " : " + inst);
        }
        OWLNamedIndividual migraine = df.getOWLNamedIndividual(IRI.create(ns + "Mal_Migraine"));
        OWLObjectProperty estTraitePar = df.getOWLObjectProperty(IRI.create(ns + "estTraitePar"));
        String meds = reasoner.getObjectPropertyValues(migraine, estTraitePar).getFlattened().stream()
            .map(i -> i.getIRI().getShortForm()).sorted().collect(Collectors.joining(", "));
        System.out.println("Inféré — Mal_Migraine estTraitePar (inverse de traite) : " + meds);
        reasoner.dispose();
    }
}
