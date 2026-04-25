// api.js — thin wrappers around PostgREST RPCs and (later) the parcel-qa
// Edge Function. Decouples the UI from the supabase client so the drawer
// can be unit-tested with a stub.
//
// Usage from app.js after creating the Supabase client:
//   ParcelAPI.init(sb);
//   const data = await ParcelAPI.getParcel(id);
//   const constraints = await ParcelAPI.getConstraints(id);

(function () {
  let _sb = null;

  function requireSb() {
    if (!_sb) throw new Error('ParcelAPI used before init(sb)');
    return _sb;
  }

  async function getParcel(parcelId) {
    const { data, error } = await requireSb()
      .from('parcels')
      .select('parcel_id,zoning,zoning_overlay,zoning_source,metadata')
      .eq('parcel_id', String(parcelId))
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function getConstraints(parcelId) {
    // PostgREST exposes SQL functions at /rpc/<name>. supabase-js wraps it.
    const { data, error } = await requireSb()
      .rpc('get_parcel_constraints', { p_parcel_id: String(parcelId) });
    if (error) throw error;
    return data;
  }

  // Phase B / C placeholders — wire once their RPCs / Edge Function ship.
  async function getCases(/* parcelId */) {
    return { not_implemented: true };
  }

  async function ask(/* parcelId, question */) {
    throw new Error('Q&A not enabled yet — Phase C work.');
  }

  window.ParcelAPI = {
    init(sb) { _sb = sb; },
    getParcel,
    getConstraints,
    getCases,
    ask
  };
}());
