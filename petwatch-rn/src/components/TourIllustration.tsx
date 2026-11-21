import React from 'react';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

type Kind = 'clinic' | 'records' | 'calendar' | 'nearby' | 'guidance';
function Paw({ x, y, scale = 1, fill = '#087448' }: { x: number; y: number; scale?: number; fill?: string }) {
  return <G transform={`translate(${x} ${y}) scale(${scale})`} fill={fill}><Ellipse cx="9" cy="11" rx="4" ry="6" rotation="-25" origin="9,11"/><Ellipse cx="19" cy="6" rx="4" ry="6"/><Ellipse cx="29" cy="10" rx="4" ry="6" rotation="25" origin="29,10"/><Ellipse cx="35" cy="20" rx="4" ry="5" rotation="35" origin="35,20"/><Path d="M9 27 C9 21 14 15 21 16 C28 16 34 25 31 31 C29 37 23 32 20 32 C15 32 9 35 8 31 Z"/></G>;
}

export default function TourIllustration({kind,width=210}: {kind:Kind;width?:number}) {
  return <Svg width={width} height={width*190/240} viewBox="0 0 240 190" accessible={false}>
    <Defs><LinearGradient id="tourRoof" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#238B55"/><Stop offset="1" stopColor="#005637"/></LinearGradient><LinearGradient id="tourGlass" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#B6ECDA"/><Stop offset="1" stopColor="#4FB595"/></LinearGradient><LinearGradient id="tourPaper" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFFFFF"/><Stop offset="1" stopColor="#D6EEE0"/></LinearGradient></Defs>
    <Circle cx="120" cy="92" r="81" fill="#D7F0E6"/><Circle cx="132" cy="78" r="61" fill="#E4F7EE" opacity={0.6}/><Ellipse cx="120" cy="171" rx="78" ry="7" fill="#78B995" opacity={0.23}/>
    {kind==='clinic'&&<G>
      <Rect x="62" y="88" width="117" height="78" rx="3" fill="url(#tourPaper)"/>
      <Path d="M58 88 L73 65 L167 65 L184 88 Z" fill="url(#tourRoof)"/><Path d="M58 88 H184 V96 H58 Z" fill="#006A42"/>
      <Rect x="99" y="50" width="42" height="115" rx="3" fill="#F8FFF9"/><Rect x="99" y="50" width="42" height="31" rx="3" fill="url(#tourRoof)"/>
      <Path d="M116 55 H124 V62 H131 V70 H124 V77 H116 V70 H109 V62 H116 Z" fill="#FFFFFF"/>
      <Rect x="68" y="101" width="23" height="47" rx="2" fill="#9DCBB4"/><Rect x="71" y="104" width="17" height="40" fill="url(#tourGlass)"/>
      <Path d="M72 128 L87 111 M73 136 L87 119" stroke="#F8FFFC" strokeWidth="4" opacity={0.8}/>
      <Rect x="149" y="101" width="23" height="47" rx="2" fill="#9DCBB4"/><Rect x="152" y="104" width="17" height="40" fill="url(#tourGlass)"/>
      <Path d="M153 128 L168 111 M153 138 L168 121" stroke="#F8FFFC" strokeWidth="4" opacity={0.8}/>
      <Paw x={108} y={84} scale={0.58}/>
      <Rect x="106" y="111" width="29" height="54" rx="1" fill="#0A7351"/><Rect x="110" y="115" width="21" height="49" fill="url(#tourGlass)"/>
      <Line x1="120" y1="116" x2="120" y2="164" stroke="#E4F6EB" strokeWidth="2"/><Path d="M111 143 L129 123" stroke="#E3FFF2" strokeWidth="3"/>
      <Circle cx="124" cy="145" r="1.7" fill="#075D40"/><Rect x="102" y="108" width="37" height="5" rx="1" fill="#095E40"/>
      <Path d="M101 165 H140 L144 170 H97 Z" fill="#9EC9B2"/>
      <Circle cx="56" cy="160" r="10" fill="#74B65B"/><Circle cx="49" cy="165" r="6" fill="#4B984A"/><Circle cx="183" cy="162" r="9" fill="#58A354"/><Circle cx="191" cy="166" r="5" fill="#267646"/>
      <Path d="M43 171 H197" stroke="#17633A" strokeWidth="3" strokeLinecap="round"/>
    </G>}
    {kind==='records'&&<G>
      <Rect x="71" y="38" width="104" height="126" rx="11" fill="#529975" opacity={0.22}/><Rect x="65" y="32" width="105" height="128" rx="11" fill="url(#tourRoof)"/>
      <Rect x="72" y="42" width="91" height="109" rx="6" fill="url(#tourPaper)"/><Rect x="95" y="25" width="47" height="22" rx="7" fill="#0A6B49"/>
      <Rect x="105" y="29" width="27" height="7" rx="3" fill="#C2E7D4"/><Paw x={103} y={63} scale={0.85}/>
      {[109,123,137].map(y=><G key={y}><Circle cx="87" cy={y} r="3" fill="#279C65"/><Line x1="98" y1={y} x2="147" y2={y} stroke="#94C5AA" strokeWidth="4" strokeLinecap="round"/></G>)}
      <Circle cx="171" cy="148" r="21" fill="#FFFFFF"/><Circle cx="171" cy="148" r="17" fill="#218B58"/><Path d="M162 148 L168 154 L180 141" stroke="#FFFFFF" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </G>}
    {kind==='calendar'&&<G>
      <Rect x="53" y="46" width="139" height="117" rx="13" fill="#5DAD83" opacity={0.2}/><Rect x="47" y="40" width="140" height="119" rx="13" fill="url(#tourPaper)" stroke="#168153" strokeWidth="3"/>
      <Path d="M60 40 H174 Q187 40 187 53 V77 H47 V53 Q47 40 60 40 Z" fill="url(#tourRoof)"/>
      <Line x1="79" y1="30" x2="79" y2="54" stroke="#0A603E" strokeWidth="8" strokeLinecap="round"/><Line x1="153" y1="30" x2="153" y2="54" stroke="#0A603E" strokeWidth="8" strokeLinecap="round"/>
      {[94,116,138].map(y=>[70,99,128,157].map(x=><Rect key={`${x}-${y}`} x={x-5} y={y-5} width="10" height="10" rx="3" fill="#89C6A5"/>))}
      <Circle cx="168" cy="149" r="23" fill="#FFFFFF"/><Circle cx="168" cy="149" r="19" fill="#168957"/><Path d="M158 149 L165 156 L178 141" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    </G>}
    {kind==='nearby'&&<G>
      <Path d="M45 80 L94 64 L145 81 L193 65 V159 L145 175 L94 158 L45 174 Z" fill="#EDF9F1" stroke="#80BA9A" strokeWidth="2"/>
      <Path d="M94 65 V158 L145 175 V81 Z" fill="#C5E7D6"/><Path d="M49 123 L92 108 L143 129 L189 112 M69 78 L77 164 M165 77 L154 168" stroke="#FFFFFF" strokeWidth="8" fill="none"/>
      <Path d="M147 58 C147 40 134 29 118 29 C101 29 89 41 89 58 C89 80 118 108 118 108 C118 108 147 80 147 58 Z" fill="url(#tourRoof)"/>
      <Circle cx="118" cy="57" r="18" fill="#F5FFF8"/><Paw x={104} y={43} scale={0.67}/>
      <Path d="M147 137 H177 V162 H147 Z" fill="#F9FFFC" stroke="#3D9D70" strokeWidth="2"/><Path d="M142 137 L153 125 H171 L182 137 Z" fill="#16764E"/><Path d="M159 141 H165 V147 H171 V153 H165 V159 H159 V153 H153 V147 H159 Z" fill="#198656"/>
    </G>}
    {kind==='guidance'&&<G>
      <Path d="M119 58 C95 40 73 41 48 49 V149 C75 141 96 144 119 161 C142 144 164 141 191 149 V49 C166 41 143 40 119 58 Z" fill="#13714B"/>
      <Path d="M115 62 C94 49 76 47 55 54 V141 C79 136 96 144 115 153 Z M123 62 C144 49 163 47 184 54 V141 C160 136 143 144 123 153 Z" fill="url(#tourPaper)"/>
      <Line x1="119" y1="60" x2="119" y2="159" stroke="#79B99A" strokeWidth="3"/>
      {[75,90,105,120].map(y=><Line key={y} x1="69" y1={y} x2="102" y2={y+5} stroke="#8EBDA3" strokeWidth="4" strokeLinecap="round"/>)}
      <Paw x={136} y={76} scale={1.02}/><Path d="M139 128 Q155 120 173 126" fill="none" stroke="#8EBDA3" strokeWidth="4" strokeLinecap="round"/>
    </G>}
  </Svg>;
}
