using UnityEngine;
using System.Collections;

/// <summary>
/// Controls a zombie riding a road bike at 15 mph. The prefab has two distinct
/// physics objects as children:
///
///   ZombieOnBike (root — this script, single trigger Collider)
///   ├── ZombieCharacter   — standard Unity ragdoll hierarchy (Rigidbody on
///   │                       each bone, all kinematic while riding)
///   └── Bike              — road-bike mesh with its OWN Rigidbody (kinematic
///                           while riding, freed on impact to tumble separately)
///
/// On impact the zombie and the bike separate with different forces:
///   • Zombie  — launches forward and UP, somersaulting over the handlebars.
///   • Bike    — spins sideways and slides along the road.
///
/// Animator state names expected on ZombieCharacter:
///   "Pedal"  — looping cycling animation while riding
/// </summary>
public class ZombieController : MonoBehaviour
{
    public enum TravelDirection { WithTraffic, AgainstTraffic }

    // ── Riding ───────────────────────────────────────────────────────────────

    [Header("Movement")]
    public TravelDirection direction = TravelDirection.WithTraffic;

    [Tooltip("15 mph = 6.71 m/s")]
    public float rideSpeed = 6.71f;

    [Header("Cycling Sway")]
    [Tooltip("Side-to-side lean amplitude (degrees) — mimics a real cyclist's rhythm.")]
    public float swayAngle = 4f;
    [Tooltip("Full sway cycles per second.")]
    public float swayFrequency = 1.1f;

    // ── Hit — zombie body ────────────────────────────────────────────────────

    [Header("Zombie Hit Forces")]
    [Tooltip("Forward + upward launch when the zombie leaves the saddle.")]
    public float zombieLaunchForce = 1000f;
    [Tooltip("Extra upward kick so the zombie clears the handlebars.")]
    public float zombieUpwardBias = 500f;
    [Tooltip("Random spin applied to each ragdoll bone for tumbling.")]
    public float zombieSpinTorque = 600f;

    // ── Hit — bike ───────────────────────────────────────────────────────────

    [Header("Bike Hit Forces")]
    [Tooltip("Root Transform of the bike child object.")]
    public Transform bikePivot;
    [Tooltip("Rigidbody on the bike root — must exist and be set Kinematic in the prefab.")]
    public Rigidbody bikeRigidbody;

    [Tooltip("Sideways push applied to the bike frame on separation.")]
    public float bikeSideForce = 400f;
    [Tooltip("Forward skid force applied to the bike.")]
    public float bikeForwardForce = 300f;
    [Tooltip("Spin torque on the bike so it cartwheels/rolls.")]
    public float bikeTorque = 700f;

    // ── Lifecycle ────────────────────────────────────────────────────────────

    [Header("Lifecycle")]
    [Tooltip("Seconds before the whole thing despawns after a hit.")]
    public float despawnDelay = 5f;
    [Tooltip("Metres behind the player before a missed cyclist is culled.")]
    public float despawnDistanceBehind = 35f;

    // ── Internal ─────────────────────────────────────────────────────────────

    Animator animator;
    Collider rootCollider;
    Rigidbody[] zombieRagdollBodies;
    Collider[] zombieRagdollColliders;
    bool isHit;
    Transform playerTransform;
    float swayTimer;

    static readonly int AnimPedal = Animator.StringToHash("Pedal");

    // ── Unity lifecycle ───────────────────────────────────────────────────────

    void Awake()
    {
        // Animator lives on the ZombieCharacter child — find it downward
        animator = GetComponentInChildren<Animator>();
        rootCollider = GetComponent<Collider>();

        // Collect only the bones that belong to the zombie character,
        // NOT the bike's Rigidbody (which is handled separately).
        var allBodies    = GetComponentsInChildren<Rigidbody>(true);
        var allColliders = GetComponentsInChildren<Collider>(true);

        // Exclude the bike Rigidbody from the ragdoll lists
        System.Collections.Generic.List<Rigidbody> zombieBones = new();
        System.Collections.Generic.List<Collider>  zombieCols  = new();

        foreach (var rb  in allBodies)    { if (rb  != bikeRigidbody)               zombieBones.Add(rb); }
        foreach (var col in allColliders) { if (col != rootCollider && !IsBikeCol(col)) zombieCols.Add(col); }

        zombieRagdollBodies     = zombieBones.ToArray();
        zombieRagdollColliders  = zombieCols.ToArray();

        SetZombieRagdollActive(false);
        if (bikeRigidbody) bikeRigidbody.isKinematic = true;
    }

    void Start()
    {
        playerTransform = FindObjectOfType<PlayerVehicle>()?.transform;

        if (direction == TravelDirection.AgainstTraffic)
            transform.rotation = Quaternion.Euler(0f, 180f, 0f);

        if (animator) animator.SetBool(AnimPedal, true);
    }

    void Update()
    {
        if (isHit || !GameManager.Instance.IsGameActive()) return;

        // Cycle forward
        transform.Translate(Vector3.forward * rideSpeed * Time.deltaTime);

        // Subtle side-to-side lean (bike sway)
        swayTimer += Time.deltaTime;
        float lean = Mathf.Sin(swayTimer * swayFrequency * Mathf.PI * 2f) * swayAngle;
        transform.localRotation = Quaternion.Euler(0f, transform.localEulerAngles.y, lean);

        // Cull if too far behind the player
        if (playerTransform != null)
        {
            float localZ = playerTransform.InverseTransformPoint(transform.position).z;
            if (localZ < -despawnDistanceBehind) Destroy(gameObject);
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /// <summary>
    /// Called by VehicleCollision on impact.
    /// The zombie somersaults off the bike; the bike skids and tumbles separately.
    /// </summary>
    public void TakeHit(Vector3 hitDirection, Vector3 hitPoint)
    {
        if (isHit) return;
        isHit = true;

        if (animator)      animator.enabled      = false;
        if (rootCollider)  rootCollider.enabled  = false;

        SeparateBike(hitDirection);
        LaunchZombie(hitDirection, hitPoint);

        StartCoroutine(DespawnAfter(despawnDelay));
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /// <summary>Detach the bike and send it skidding sideways.</summary>
    void SeparateBike(Vector3 hitDirection)
    {
        if (bikeRigidbody == null) return;

        // Unparent so the bike physics are independent of the root transform
        bikePivot.SetParent(null, worldPositionStays: true);
        bikeRigidbody.isKinematic = false;

        // Sideways skid (randomise left or right) + slight forward carry
        Vector3 side    = Vector3.Cross(hitDirection, Vector3.up).normalized;
        float   sideDir = Random.value > 0.5f ? 1f : -1f;
        Vector3 force   = side * bikeSideForce * sideDir
                        + hitDirection.normalized * bikeForwardForce;

        bikeRigidbody.AddForce(force, ForceMode.Impulse);

        // Cartwheel / rolling tumble
        bikeRigidbody.AddTorque(
            new Vector3(
                Random.Range(-bikeTorque, bikeTorque),
                Random.Range(-bikeTorque * 0.3f, bikeTorque * 0.3f),
                Random.Range(-bikeTorque, bikeTorque)),
            ForceMode.Impulse);

        Destroy(bikePivot.gameObject, despawnDelay);
    }

    /// <summary>Activate the zombie ragdoll and send it flying over the bars.</summary>
    void LaunchZombie(Vector3 hitDirection, Vector3 hitPoint)
    {
        SetZombieRagdollActive(true);

        // Primary force: forward (hit direction) + strong upward kick
        Vector3 force = hitDirection.normalized * zombieLaunchForce
                      + Vector3.up * zombieUpwardBias;

        foreach (Rigidbody bone in zombieRagdollBodies)
        {
            bone.AddForceAtPosition(force, hitPoint, ForceMode.Impulse);
            bone.AddTorque(Random.insideUnitSphere * zombieSpinTorque, ForceMode.Impulse);
        }
    }

    void SetZombieRagdollActive(bool active)
    {
        foreach (Rigidbody rb  in zombieRagdollBodies)    rb.isKinematic = !active;
        foreach (Collider  col in zombieRagdollColliders) col.enabled    = active;
    }

    /// <summary>Returns true if a collider belongs to the bike subtree.</summary>
    bool IsBikeCol(Collider col)
        => bikePivot != null && col.transform.IsChildOf(bikePivot);

    IEnumerator DespawnAfter(float delay)
    {
        yield return new WaitForSeconds(delay);
        Destroy(gameObject);
    }
}
