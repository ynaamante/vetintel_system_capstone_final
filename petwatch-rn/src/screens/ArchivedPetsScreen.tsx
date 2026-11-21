import AppHeader from '../components/AppHeader';
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { ownerCareApi } from '../services/api';
import { colors } from '../theme/colors';
const BOLD = { fontFamily: 'VetIntelHomeBold', fontWeight: 'normal' as const };
export default function ArchivedPetsScreen({ navigation }: any) {
  const { token } = useAuth();
  const { colors: tc } = useTheme();
  const [pets,setPets] = useState<any[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [restoring,setRestoring] = useState<string | null>(null);
  const load = useCallback(async (active: () => boolean = () => true) => {
    if (!token) return;
    try { const rows=await ownerCareApi.archivedPets(token);if(active()){setPets(rows);setError('');} }
    catch(failure:any){if(active())setError(failure.message || 'Unable to load archived pets.');}
    finally{if(active())setLoading(false);}
  },[token]);
  useFocusEffect(useCallback(()=>{let active=true;void load(()=>active);return()=>{active=false;};},[load]));
  const restore = async (pet:any) => {
    if (!token || restoring) return;
    setRestoring(`${pet.source}-${pet.id}`);
    try{await ownerCareApi.archivePet(String(pet.id),pet.source,false,token);await load();Toast.show({type:'success',text1:`${pet.name} restored`,text2:'Your pet is back in My pets.'});}
    catch(failure:any){Toast.show({type:'error',text1:failure.message || 'Unable to restore this pet.'});}
    finally{setRestoring(null);}
  };
  return <SafeAreaView style={{flex:1,backgroundColor:tc.background}}><AppHeader title="Archived pets" /><Text style={{paddingHorizontal:20,paddingBottom:12,fontSize:14,lineHeight:21,color:tc.textSecondary}}>Restore a pet to show it in My pets again. Medical records and appointments are kept.</Text>{!!error&&<TouchableOpacity onPress={()=>load()}><Text style={{color:colors.danger,padding:20}}>{error} Tap to retry.</Text></TouchableOpacity>}<FlatList data={pets} keyExtractor={p=>`${p.source}-${p.id}`} refreshing={loading} onRefresh={()=>{setLoading(true);void load();}} contentContainerStyle={{padding:16}} renderItem={({item})=><View style={{padding:14,marginBottom:12,backgroundColor:tc.surface,borderRadius:14,borderWidth:1,borderColor:'#E0E2E1'}}><View style={{flexDirection:'row',alignItems:'center',gap:12}}>{item.photo_url?<Image source={{uri:item.photo_url}} style={{width:60,height:60,borderRadius:12}}/>:<Ionicons name="paw-outline" size={36} color={colors.primary}/>}<View style={{flex:1}}><Text style={{...BOLD,fontSize:18,color:tc.text}}>{item.name}</Text><Text style={{color:tc.textSecondary,fontSize:13,marginTop:4}}>{item.species} · {item.breed || 'Breed not recorded'}</Text><Text style={{color:tc.textSecondary,fontSize:12,marginTop:3}}>{item.clinic_name || 'My pet profile'}</Text></View></View><TouchableOpacity disabled={!!restoring} onPress={()=>restore(item)} style={{minHeight:48,backgroundColor:colors.primary,borderRadius:12,alignItems:'center',justifyContent:'center',marginTop:14,opacity:restoring?0.6:1}}>{restoring===`${item.source}-${item.id}`?<ActivityIndicator color="#fff"/>:<Text style={{...BOLD,fontSize:15,color:'#fff'}}>Restore pet</Text>}</TouchableOpacity></View>} ListEmptyComponent={<View style={{alignItems:'center',padding:36,gap:12}}><Ionicons name="archive-outline" size={44} color={tc.textMuted}/><Text style={{color:tc.text,...BOLD,fontSize:17}}>{loading?'Loading...':error?'Unable to load pets':'No archived pets'}</Text></View>}/></SafeAreaView>;
}
