import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  class_group: string;
};

function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function syntheticEmail(first: string, last: string, group: string) {
  const f = slug(first) || "u";
  const l = slug(last) || "u";
  const g = slug(group) || "u";
  return `${f}.${l}.${g}@fidgets.local`;
}
export { supabase };
