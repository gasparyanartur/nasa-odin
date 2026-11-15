import type { RouteDiagnostics, RouteResult, ReturnResult } from '../data';
import type { PlannerData, PlannerRequest } from './core';
export type Operation='routes'|'return';
export interface Work { id:number; operation:Operation; request:PlannerRequest; data?:PlannerData }
export type Reply={id:number;result:RouteResult|ReturnResult}|{id:number;error:{message:string;diagnostics?:RouteDiagnostics}};
