import DiseaseMonitoringWorkspace from '../components/DiseaseMonitoringWorkspace';
export function RiskMonitoringPage({user,initialFilters,onFiltersChange,onNavigate}){return <DiseaseMonitoringWorkspace onFiltersChange={onFiltersChange} onNavigate={onNavigate} initialFilters={initialFilters} user={user} risk/>;}
export default RiskMonitoringPage;
