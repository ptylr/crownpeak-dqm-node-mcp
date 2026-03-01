using UnityEngine;
using System.Collections;

/// <summary>
/// Controls a single zombie. Walks at 15 mph (6.7 m/s) either with or against
/// traffic. On vehicle impact, switches to ragdoll mode with comedy physics:
/// the zombie flies, tumbles, somersaults, and slides before despawning.
///
/// Ragdoll setup: the zombie prefab must have a standard Unity ragdoll hierarchy
/// (Rigidbody + Collider on each bone). The root Animator and a single trigger
/// Collider on the root are used during walking; ragdoll Rigidbodies are
/// kinematic until impact.
/// </summary>
public class ZombieController : MonoBehaviour
{
    public enum TravelDirection { WithTraffic, AgainstTraffic }

    [Header("Movement")]
    public TravelDirection direction = TravelDirection.WithTraffic;

    [Tooltip("15 mph = 6.71 m/s")]
    public float walkSpeed = 6.71f;

    [Header("Ragdoll Hit Forces")]
    public float launchForce = 900f;
    public float upwardBias = 400f;
    public float spinTorque = 500f;

    [Header("Lifecycle")]
    [Tooltip("Seconds after hitting ground before despawn.")]
    public float despawnDelay = 4f;
    [Tooltip("Despawn if this many metres behind the player.")]
    public float despawnDistanceBehind = 35f;

    // Internal state
    Animator animator;
    Collider rootCollider;          // Walking trigger collider on the root
    Rigidbody[] ragdollBodies;
    Collider[] ragdollColliders;
    bool isHit;
    Transform playerTransform;

    static readonly int AnimWalk = Animator.StringToHash("Walk");

    void Awake()
    {
        animator = GetComponent<Animator>();
        rootCollider = GetComponent<Collider>();

        // Gather all child Rigidbodies / Colliders that form the ragdoll
        ragdollBodies = GetComponentsInChildren<Rigidbody>(true);
        ragdollColliders = GetComponentsInChildren<Collider>(true);

        SetRagdollActive(false);
    }

    void Start()
    {
        playerTransform = FindObjectOfType<PlayerVehicle>()?.transform;

        // Face the correct direction relative to world forward (road direction)
        if (direction == TravelDirection.AgainstTraffic)
            transform.rotation = Quaternion.Euler(0f, 180f, 0f);

        if (animator) animator.SetBool(AnimWalk, true);
    }

    void Update()
    {
        if (isHit || !GameManager.Instance.IsGameActive()) return;

        // Walk forward in local space (facing direction already set)
        transform.Translate(Vector3.forward * walkSpeed * Time.deltaTime);

        // Cull zombies that have passed the vehicle
        if (playerTransform != null)
        {
            float localZ = playerTransform.InverseTransformPoint(transform.position).z;
            if (localZ < -despawnDistanceBehind) Destroy(gameObject);
        }
    }

    /// <summary>
    /// Called by VehicleCollision when the vehicle strikes this zombie.
    /// Disables walking and activates ragdoll physics for comedic effect.
    /// </summary>
    public void TakeHit(Vector3 hitDirection, Vector3 hitPoint)
    {
        if (isHit) return;
        isHit = true;

        if (animator) animator.enabled = false;
        if (rootCollider) rootCollider.enabled = false;

        SetRagdollActive(true);

        // Apply launch force + random spin to every ragdoll bone
        Vector3 force = hitDirection.normalized * launchForce + Vector3.up * upwardBias;
        foreach (Rigidbody bone in ragdollBodies)
        {
            bone.AddForceAtPosition(force, hitPoint, ForceMode.Impulse);
            bone.AddTorque(Random.insideUnitSphere * spinTorque, ForceMode.Impulse);
        }

        StartCoroutine(DespawnAfter(despawnDelay));
    }

    void SetRagdollActive(bool active)
    {
        foreach (Rigidbody rb in ragdollBodies)
            rb.isKinematic = !active;

        foreach (Collider col in ragdollColliders)
        {
            // Never re-enable the root collider here — it is managed separately
            if (col != rootCollider) col.enabled = active;
        }
    }

    IEnumerator DespawnAfter(float delay)
    {
        yield return new WaitForSeconds(delay);
        Destroy(gameObject);
    }
}
