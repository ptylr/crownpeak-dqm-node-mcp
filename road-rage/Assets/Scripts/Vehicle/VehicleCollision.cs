using UnityEngine;
using System.Collections.Generic;

/// <summary>
/// Detects collisions between the vehicle's front bumper and zombies.
/// Notifies GameManager of the hit, then triggers the zombie's ragdoll reaction.
/// Uses a per-frame dedup list so a single physics event can't score the same
/// zombie twice in one frame.
/// </summary>
public class VehicleCollision : MonoBehaviour
{
    [Header("Hit Effect")]
    [Tooltip("Particle system prefab spawned at the hit point (stars, cake icons, etc.)")]
    public GameObject hitVFXPrefab;

    [Header("Audio")]
    public AudioClip[] bumpSounds;

    AudioSource audioSource;

    // Tracks zombies already processed this frame to avoid double-counting
    readonly HashSet<ZombieController> hitThisFrame = new HashSet<ZombieController>();

    void Awake() => audioSource = GetComponent<AudioSource>();

    void OnCollisionEnter(Collision col)
    {
        ZombieController zombie = col.gameObject.GetComponentInParent<ZombieController>();
        if (zombie == null || hitThisFrame.Contains(zombie)) return;

        hitThisFrame.Add(zombie);

        ContactPoint contact = col.contacts[0];
        Vector3 hitPoint = contact.point;
        Vector3 hitDir = col.relativeVelocity.normalized;

        // Trigger ragdoll
        zombie.TakeHit(hitDir, hitPoint);

        // Score + VFX + audio
        GameManager.Instance.RegisterHit(1, hitPoint);

        if (hitVFXPrefab) Instantiate(hitVFXPrefab, hitPoint, Quaternion.identity);
        PlayBumpSound();
    }

    void LateUpdate() => hitThisFrame.Clear();

    void PlayBumpSound()
    {
        if (audioSource == null || bumpSounds.Length == 0) return;
        audioSource.PlayOneShot(bumpSounds[Random.Range(0, bumpSounds.Length)]);
    }
}
