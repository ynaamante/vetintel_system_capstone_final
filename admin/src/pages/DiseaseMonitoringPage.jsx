import DiseaseMonitoringWorkspace from '../components/DiseaseMonitoringWorkspace';
export default function DiseaseMonitoringPage({user,initialFilters,onFiltersChange,onNavigate}){return <DiseaseMonitoringWorkspace onFiltersChange={onFiltersChange} onNavigate={onNavigate} initialFilters={initialFilters} user={user}/>;}
