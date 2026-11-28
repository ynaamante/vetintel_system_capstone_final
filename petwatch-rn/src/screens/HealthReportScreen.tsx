import AppHeader from '../components/AppHeader';
import { roundedScreenPanel } from '../components/HeaderSurface';
﻿import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, FlatList, TextInput, Image, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import NavigationIcon from '../components/NavigationIcon';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { ownerCareApi } from '../services/api';
import { colors } from '../theme/colors';
import { dateLabel } from '../utils/ownerCare';
import { medicalCategory, medicalCategories, filterMedicalActivity, escapeReportHtml as htmlText } from '../utils/medicalActivity';
import type { OwnerMedicalRecord } from '../utils/medicalActivity';

const GREEN = colors.primary;
const BOLD = { fontWeight: '700' as const };
export default function HealthReportScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const pet = route.params?.pet;
  const { token } = useAuth();
  const { colors: tc, isDark } = useTheme();
  const [records,setRecords] = useState<(OwnerMedicalRecord & { categoryGroup: string })[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [category,setCategory] = useState('All');
  const [search,setSearch] = useState('');
  const [exporting,setExporting] = useState(false);
  const load = useCallback(async(active: () => boolean = () => true) => {
    if (!token || !pet) { setLoading(false); return; }
    if (pet.source !== 'clinic') { setRecords([]);setLoading(false);return; }
    try { const data=await ownerCareApi.medicalActivity(String(pet.id),token);if(active()){setRecords(data.records.map(record=>({...record,categoryGroup:medicalCategory(record)})));setError('');} }
    catch(failure:any){if(active())setError(failure.message || 'Unable to load medical records.');}
    finally{if(active())setLoading(false);}
  },[token,pet?.id,pet?.source]);
  useFocusEffect(useCallback(()=>{let active=true;void load(()=>active);const timer=setInterval(()=>{void load(()=>active);},15000);return()=>{active=false;clearInterval(timer);};},[load]));
  const visible = filterMedicalActivity(records,category,search);
  const s = styles(tc,isDark);
  const icon = (name:any,size=22,color=tc.text) => <Ionicons name={name} size={size} color={color}/>;
  const main = (screen:string) => navigation.navigate('Main',{screen});
  const download = async () => {
    if (!pet || exporting || loading || error || !visible.length) return;
    setExporting(true);
    try {
      const html=`<!doctype html><html><head><meta charset="utf-8"/><style>@page{margin:36px}body{font-family:Arial,sans-serif;color:#14211c;font-size:12px;line-height:1.5}h1{font-size:25px;color:#013826;margin-bottom:6px}h2{font-size:17px}article{border-top:1px solid #ddd;padding:12px 0;break-inside:avoid}p{white-space:pre-wrap;margin:6px 0}.muted{color:#43534b}.badge{color:#086b50;font-weight:bold}footer{margin-top:24px;border-top:1px solid #ddd;padding-top:10px}</style></head><body><h1>${htmlText(pet.name)} · Health Report</h1><p>${htmlText(pet.breed || pet.species || '')}</p><p class="muted">Medical records from your veterinary clinic. Generated ${htmlText(new Date().toLocaleString())}.</p><p>Filter: ${htmlText(category)}${search.trim()?` · Search: ${htmlText(search.trim())}`:''} · ${visible.length} record(s)</p>${visible.map(r=>`<article><h2>${htmlText(r.title)}</h2><p class="muted">${htmlText(r.clinicName)} · ${htmlText(r.categoryGroup)} · ${r.dateIsShared?'Shared ':''}${htmlText(dateLabel(r.date || ''))}</p><p class="badge">${htmlText(r.status)}</p><p>${htmlText(r.detail || 'No additional details recorded.')}</p>${r.verifiedBy?`<p>Verified by: ${htmlText(r.verifiedBy)}</p>`:''}</article>`).join('')}<footer>This report includes available clinic medical records. Draft records and internal notes are excluded.</footer></body></html>`;
      if (Platform.OS === 'web') await Print.printAsync({html});
      else {
        if (!await Sharing.isAvailableAsync()) throw new Error('Saving or sharing PDF files is unavailable on this device.');
        const file=await Print.printToFileAsync({html});
        await Sharing.shareAsync(file.uri,{mimeType:'application/pdf',UTI:'com.adobe.pdf',dialogTitle:`Save ${pet.name}'s health report`});
      }
    }catch(failure:any){Toast.show({type:'error',text1:failure.message || 'Unable to download the report.'});}
    finally{setExporting(false);}
  };
  if (!pet) return <SafeAreaView style={s.safe}><Text style={s.body}>Open a pet profile to view its health report.</Text><TouchableOpacity onPress={()=>main('Home')}><Text style={s.link}>Go to Home</Text></TouchableOpacity></SafeAreaView>;
  const age=pet.age ? `${pet.age} years old` : pet.birth_date ? `${Math.max(0,Math.floor((Date.now()-new Date(pet.birth_date).getTime())/31557600000))} years old` : '';
  const rowColor=(status:string)=> /under review|pending|suspected|draft/i.test(status)?colors.warningText:/denied|cancel|revoke|expired/i.test(status)?colors.danger:colors.primary;
  return <SafeAreaView style={s.safe} edges={['top','left','right']}>
    <AppHeader title="Health Report" onBack={() => navigation.goBack()} />
    <View style={s.contentPanel}><FlatList data={visible} keyExtractor={r=>r.key} contentContainerStyle={s.list} refreshing={loading} onRefresh={()=>{setLoading(true);void load();}} keyboardShouldPersistTaps="handled"
      ListHeaderComponent={<><LinearGradient colors={isDark?[tc.surface,tc.background]:[colors.white,colors.white]} start={{x:0,y:0}} end={{x:1,y:1}} style={s.petCard}>{(pet.photo_url || pet.photoUrl)?<Image source={{uri:pet.photo_url || pet.photoUrl}} style={s.photo}/>:<View style={s.photo}>{icon('paw-outline',38,colors.primary)}</View>}<View style={{flex:1}}><Text style={s.petName}>{pet.name}</Text><Text style={s.body}>{[pet.breed || pet.species,age].filter(Boolean).join(' · ')}</Text><View style={s.sharedTag}><Text style={s.tagText}>Medical records from your veterinary clinic.</Text></View></View></LinearGradient>
      <View style={s.activityHeader}><View style={{flex:1}}><Text style={s.heading}>Medical Activity</Text><Text style={s.body}>Your pet's clinic medical records.</Text></View><TouchableOpacity accessibilityLabel="Download health report PDF" onPress={download} disabled={exporting || loading || !!error || !visible.length} style={[s.download,{opacity:exporting || loading || !!error || !visible.length?0.45:1}]}>{exporting?<ActivityIndicator size="small" color={colors.primary}/>:icon('download-outline',19,colors.primary)}<Text style={s.link}>{exporting?'Preparing...':'Download'}</Text></TouchableOpacity></View>
      <View style={s.searchBox}>{icon('search-outline',20,tc.textSecondary)}<TextInput accessibilityLabel="Search medical records" value={search} onChangeText={setSearch} placeholder="Search medical records" placeholderTextColor={tc.textMuted} style={s.searchInput}/>{!!search&&<TouchableOpacity accessibilityLabel="Clear search" onPress={()=>setSearch('')}>{icon('close-circle-outline',19,tc.textSecondary)}</TouchableOpacity>}</View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categories}>{medicalCategories.map(item=><TouchableOpacity key={item} accessibilityRole="tab" accessibilityState={{selected:item===category}} onPress={()=>setCategory(item)} style={[s.category,item===category&&s.activeCategory]}><Text style={item===category?s.activeCategoryText:s.categoryText}>{item}</Text></TouchableOpacity>)}</ScrollView>
      {!!error&&<TouchableOpacity onPress={()=>load()}><Text style={s.error}>{error} Tap to retry.</Text></TouchableOpacity>}</>}
      renderItem={({ item }) => (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`View ${item.title}`}
          style={s.record}
          onPress={() => navigation.push('HealthRecordDetails', { petId: String(pet.id), recordKey: item.key })}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.recordTitle}>{item.title}</Text>
            <Text style={s.body} numberOfLines={1}>{item.clinicName}</Text>
            <Text style={s.small}>{item.dateIsShared ? 'Shared ' : ''}{dateLabel(item.date || '')}</Text>
          </View>
          <View style={s.status}>
            <View style={[s.statusDot, { backgroundColor: rowColor(item.status) }]} />
            <Text style={[s.statusText, { color: rowColor(item.status) }]} numberOfLines={2}>{item.status}</Text>
          </View>
          {icon('chevron-forward', 21)}
        </TouchableOpacity>
      )}
      ListEmptyComponent={<View style={s.empty}>{loading?<ActivityIndicator color={colors.primary}/>:icon('document-text-outline',40,tc.textMuted)}<Text style={s.recordTitle}>{loading?'Loading medical records...':error?'Records could not be loaded':records.length?'No matching records':'No medical records yet'}</Text>{!loading&&!error&&<Text style={[s.body,{textAlign:'center'}]}>{records.length?'Try another category or search term.':pet.source==='clinic'?'Completed visits, finalized diagnoses, treatments, verified tests and vaccinations appear when recorded by your clinic.':'Clinic records will appear after your pet is linked to a registered clinic patient.'}</Text>}</View>}/>
    </View><View style={[s.bottomBar,{paddingBottom:Math.max(7,insets.bottom)}]}>{[{screen:'Home',icon:'home',label:'Home'},{screen:'Appointments',icon:'calendar-outline',label:'Appointments'},{screen:'Alerts',icon:'notifications-outline',label:'Alerts'},{screen:'Profile',icon:'person-outline',label:'Profile'}].map(item=><TouchableOpacity key={item.screen} style={s.bottomItem} onPress={()=>main(item.screen)}><View style={[s.bottomIcon,item.screen==='Home'&&s.selectedIcon]}><NavigationIcon name={item.screen} color={item.screen==='Home'?GREEN:tc.text}/></View><Text style={[s.bottomLabel,item.screen==='Home'&&{color:colors.primary}]}>{item.label}</Text>{item.screen==='Home'&&<View style={s.activeUnderline}/>}</TouchableOpacity>)}</View>
  </SafeAreaView>;
}
const styles=(tc:any,dark:boolean)=>StyleSheet.create({
  safe:{flex:1,backgroundColor:tc.background},contentPanel: { ...roundedScreenPanel, backgroundColor:dark?tc.background:colors.white},nav:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:8,paddingVertical:4},title:{...BOLD,fontSize:23,color:colors.white,flex:1},list:{paddingHorizontal:11,paddingTop:16,paddingBottom:24},
  petCard:{borderRadius:15,borderWidth:1,borderColor:tc.border,padding:12,flexDirection:'row',alignItems:'center',gap:14},photo:{width:94,height:96,borderRadius:10,backgroundColor:dark?tc.surface:colors.paleSage,justifyContent:'center',alignItems:'center'},petName:{...BOLD,fontSize:25,color:tc.text},body:{fontSize:13,lineHeight:19,color:tc.textSecondary},small:{fontSize:12,lineHeight:17,color:tc.textSecondary},sharedTag:{alignSelf:'flex-start',backgroundColor:dark?tc.surface:colors.paleSage,borderRadius:14,paddingHorizontal:10,paddingVertical:4,marginTop:7},tagText:{fontSize:12,lineHeight:16,color:dark?tc.text:colors.deepForest},
  activityHeader:{flexDirection:'row',alignItems:'center',gap:10,marginTop:17,marginBottom:13},heading:{...BOLD,fontSize:22,lineHeight:28,color:dark?tc.text:GREEN},download:{minHeight:42,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:6,backgroundColor:dark?tc.surface:colors.paleSage,borderRadius:20},link:{...BOLD,fontSize:14,color:dark?tc.text:colors.deepForest},
  searchBox:{flexDirection:'row',alignItems:'center',gap:9,borderWidth:1,borderColor:tc.border,borderRadius:12,backgroundColor:tc.surface,paddingHorizontal:12,minHeight:44},searchInput:{flex:1,fontSize:14,color:tc.text,paddingVertical:10},categories:{gap:2,paddingTop:10,marginBottom:16},category:{paddingHorizontal:11,paddingVertical:12,borderBottomWidth:3,borderColor:'transparent'},activeCategory:{borderColor:colors.primary},categoryText:{fontSize:12,color:tc.text},activeCategoryText:{...BOLD,fontSize:12,color:dark?tc.text:colors.primary},
  record:{flexDirection:'row',alignItems:'center',gap:10,minHeight:78,paddingVertical:10,paddingHorizontal:14,borderWidth:1,borderRadius:13,marginBottom:12,backgroundColor:tc.surface,borderColor:tc.border,shadowColor:'#000',shadowOpacity:0.06,shadowOffset:{width:0,height:2},shadowRadius:3,elevation:1},recordTitle:{...BOLD,fontSize:15,lineHeight:20,color:tc.text},status:{flexDirection:'row',alignItems:'center',gap:6,maxWidth:105},statusDot:{width:7,height:7,borderRadius:4},statusText:{fontSize:12,flexShrink:1,textTransform:'capitalize'},empty:{alignItems:'center',padding:30,gap:12},error:{color:colors.danger,paddingVertical:14},
  bottomIcon:{width:78,height:27,borderRadius:18,alignItems:'center',justifyContent:'center'},selectedIcon:{backgroundColor:colors.primarySoft},activeUnderline:{position:'absolute',bottom:0,width:64,height:3,borderRadius:2,backgroundColor:GREEN},bottomBar:{flexDirection:'row',backgroundColor:tc.surface,borderTopWidth:1,borderColor:tc.border,paddingVertical:7},bottomItem:{flex:1,minHeight:48,justifyContent:'center',alignItems:'center',gap:4},bottomLabel:{fontSize:12,color:tc.textSecondary},
});
